"""Approval is simulated with mocks only; never approves anything in a database."""
import io
import json
import tempfile
import unittest
import wave
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from app.api import public
from app.core.access import actor
from app.main import app
from app.services.admin_service import AdminService
from app.services.content_service import ContentService
from app.services.review_service import ReviewService


class MobileAudioFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.file = self.root / 'uploads/audio/check.wav'
        self.file.parent.mkdir(parents=True)
        with wave.open(str(self.file), 'wb') as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(8000)
            output.writeframes(b'\0\0' * 8000)
        settings = SimpleNamespace(media_root=str(self.root), public_api_base_url='')
        for target in ('review_service', 'admin_service', 'content_service'):
            patcher = patch(f'app.services.{target}.settings', settings)
            patcher.start(); self.addCleanup(patcher.stop)
        self.context_token = actor.set({'id': 1, 'role': 'Admin'})
        self.addCleanup(actor.reset, self.context_token)
        self.repo = Mock()
        self.repo._clean.side_effect = lambda config, payload, include_id: dict(payload)
        self.repo.transaction.side_effect = lambda: nullcontext(self.repo)
        self.review = ReviewService(self.repo)
        self.media = {'Id': 21, 'PoiId': 12, 'ContentType': 'audio/wav', 'FileSize': self.file.stat().st_size}

    def test_pending_edit_never_updates_canonical(self):
        row = {'Id': 12, 'Name': 'Public name', 'Latitude': 10, 'Longitude': 106,
               'RadiusMeters': 50, 'Version': 4, 'ReviewStatus': 'Approved'}
        self.review._get = Mock(return_value=row)
        self.repo.lock.return_value = row
        self.repo.latest.return_value = None
        self.review.update_resource('pois', 12, {'Name': 'Pending name'})
        self.repo.submit.assert_called_once_with('pois', row, {'Name': 'Pending name'}, 1)
        self.repo.update_row.assert_not_called()
        self.assertEqual(row['Name'], 'Public name')

    def test_track_metadata_is_derived_from_uploaded_file(self):
        self.review._get = Mock(return_value={'Id': 12})
        self.repo.fetchone.return_value = self.media
        result = self.review._allowed_payload('audio', {'POIId': 12, 'LanguageCode': 'vi',
            'AudioType': 'prerecorded', 'FileUrl': 'uploads/audio/check.wav', 'MimeType': 'audio/mpeg', 'FileSizeBytes': 1})
        self.assertEqual(result['MimeType'], 'audio/wav')
        self.assertEqual(result['FileSizeBytes'], self.file.stat().st_size)
        self.repo.fetchone.return_value = {**self.media, 'PoiId': 99}
        with self.assertRaises(HTTPException) as error:
            self.review._allowed_payload('audio', result)
        self.assertEqual(error.exception.status_code, 422)

    def test_simulated_review_requires_media_before_track(self):
        # All repository methods are mocks. No SQL connection or real approval is used.
        row = {'Id': 7, 'POIId': 12, 'FileUrl': 'uploads/audio/check.wav', 'Version': 1}
        submission = {'Id': 70, 'Resource': 'audio', 'EntityId': 7, 'BaseVersion': 1,
                      'Status': 'Pending', 'Operation': 'update', 'PayloadJson': json.dumps({'Title': 'Vietnamese recording'})}
        self.review.get_submission = Mock(return_value=submission)
        self.repo.lock.return_value = row
        self.repo.fetchone.side_effect = lambda query, params: None if 'FROM MediaFiles' in query else submission
        with self.assertRaises(HTTPException) as error:
            self.review.review(70, 'approve')
        self.assertEqual(error.exception.status_code, 409)
        self.repo.update_row.assert_not_called()
        self.repo.fetchone.side_effect = lambda query, params: self.media if 'FROM MediaFiles' in query else submission
        self.review.review(70, 'approve')
        change = self.repo.update_row.call_args.args[2]
        self.assertEqual(change['ReviewStatus'], 'Approved')
        self.assertEqual(change['Version'], 2)
        self.file.unlink()
        with self.assertRaises(HTTPException) as error:
            self.review.review(70, 'approve')
        self.assertEqual(error.exception.status_code, 409)

    def test_vendor_cannot_review_even_own_audio(self):
        token = actor.set({'id': 2, 'role': 'Vendor'})
        try:
            with self.assertRaises(HTTPException) as error:
                self.review.review(70, 'approve')
            self.assertEqual(error.exception.status_code, 403)
            self.repo.transaction.assert_not_called()
        finally:
            actor.reset(token)

    def test_real_wav_bytes_and_range_require_scoped_access(self):
        repo = Mock()
        repo.get_audio_track.return_value = {'id': 7, 'poiId': 12, 'languageCode': 'vi',
            'fileUrl': 'uploads/audio/check.wav', 'mimeType': 'audio/wav'}
        service = ContentService(repo)
        service.validate_access = lambda token: {'isValid': token in {'allowed', 'other'}, 'poiId': 99 if token == 'other' else 12}
        with patch.object(public, 'service', service):
            client = TestClient(app)
            self.addCleanup(client.close)
            url = '/api/v1/public/audio/7'
            self.assertEqual(client.get(url).status_code, 401)
            self.assertEqual(client.get(url, headers={'X-Guest-Access-Token': 'other'}).status_code, 403)
            headers = {'X-Guest-Access-Token': 'allowed'}
            response = client.get(url, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, self.file.read_bytes())
            self.assertIn('audio/wav', response.headers['content-type'])
            response = client.get(url, headers={**headers, 'Range': 'bytes=0-43'})
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.content, self.file.read_bytes()[:44])
            self.assertEqual(response.headers['content-range'], f'bytes 0-43/{self.file.stat().st_size}')
            log = '/api/v1/public/audio/7/play-log?languageCode=vi&triggerType=gps&durationPlayedSeconds=3'
            self.assertEqual(client.post(log, headers=headers).status_code, 200)
            repo.record_play_log.assert_called_once_with(12, 'vi', 'gps', None, 3)
            self.assertEqual(client.post(log.replace('Seconds=3', 'Seconds=0'), headers=headers).status_code, 422)
            self.assertEqual(client.post(log.replace('Code=vi', 'Code=en'), headers=headers).status_code, 422)

    def test_opening_metadata_is_not_a_listening_event(self):
        repo = Mock()
        repo.get_public_poi.return_value = {'id': 12}
        repo.narration_state.return_value = {'latest': None, 'published': None}
        service = ContentService(repo)
        service.validate_access = Mock(return_value={'isValid': True, 'poiId': 12})
        service.get_audio_poi(12, 'vi', 'gps', 'allowed', None)
        repo.record_play_log.assert_not_called()

    def test_generated_and_manual_files_keep_native_track_ids(self):
        repo = Mock()
        file_url = 'uploads/audio/check.wav'
        repo.narration_state.return_value = {'latest': None, 'published': {
            'id': 8, 'fileUrl': file_url, 'name': 'Published name', 'description': 'Published text',
            'sourceVersion': 1, 'narrationId': 2}}
        service = ContentService(repo)
        detail = service._media_urls({'id': 12, 'audioTracks': [{'id': 7, 'fileUrl': file_url}]}, 'vi')
        self.assertEqual([track['audioTrackId'] for track in detail['audioTracks']], [8, 7])
        self.assertTrue(all(track['isAvailable'] for track in detail['audioTracks']))

    def test_empty_or_failed_upload_leaves_no_orphan_file(self):
        uploader = AdminService(self.repo)
        empty = UploadFile(filename='empty.wav', file=io.BytesIO(b''), headers=Headers({'content-type': 'audio/wav'}))
        with self.assertRaises(HTTPException):
            uploader.upload_media(empty, 12, None, 1)
        self.repo.save_media_file.assert_not_called()
        self.repo.save_media_file.side_effect = RuntimeError('Database unavailable')
        uploaded = UploadFile(filename='recording.wav', file=io.BytesIO(self.file.read_bytes()), headers=Headers({'content-type': 'audio/wav'}))
        with self.assertRaises(RuntimeError):
            uploader.upload_media(uploaded, 12, None, 1)
        self.assertEqual(list(self.file.parent.iterdir()), [self.file])

    def test_media_urls_change_after_a_new_approved_version(self):
        image = self.root / 'uploads/images/check.png'
        image.parent.mkdir(parents=True)
        image.write_bytes(b'test-image')
        repo = Mock()
        repo.narration_state.return_value = {'latest': None, 'published': None}
        service = ContentService(repo)
        urls = []
        for version in (3, 4):
            repo.get_public_media_file.return_value = {'relativePath': 'uploads/images/check.png', 'version': version}
            detail = service._media_urls({'id': 12, 'thumbnailImageId': 21,
                'images': [{'id': 21, 'version': version, 'relativePath': 'uploads/images/check.png'}],
                'audioTracks': [{'id': 7, 'version': version, 'fileUrl': 'uploads/audio/check.wav'}]}, 'vi')
            self.assertEqual(detail['thumbnailImageVersion'], version)
            self.assertTrue(detail['images'][0]['url'].endswith(f'?v={version}'))
            self.assertTrue(detail['audioTracks'][0]['streamUrl'].endswith(f'?v={version}'))
            urls.append(detail['thumbnailUrl'])
        self.assertNotEqual(*urls, 'An approved replacement must not reuse the native image cache key')


if __name__ == '__main__':
    unittest.main()
