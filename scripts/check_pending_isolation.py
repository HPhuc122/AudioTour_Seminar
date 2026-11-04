"""Exercise pending writes in one rolled-back transaction. NEVER calls approve/reject.

Uses temporary files and the existing database; no schema changes or persistent seed data.
"""
import io
import sys
import tempfile
import uuid
import wave
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/content-service'))
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from app.core.access import actor
from app.core.config import settings
from app.core.database import get_connection
from app.repositories.content_repository import ContentRepository
from app.repositories.review_repository import ReviewRepository
from app.services.content_service import ContentService
from app.services.review_service import ReviewService


def main():
    assert settings.database == 'AudioTourVinhKhanh', 'Unexpected database'
    with get_connection() as connection:
        repo = ReviewRepository(connection)
        content_repo = ContentRepository()
        content_repo._fetchall, content_repo._fetchone = repo.fetchall, repo.fetchone
        public = ContentService(content_repo)
        management = ReviewService(repo)
        owned = repo.fetchone("SELECT TOP 1 p.Id,p.UserId FROM POIs p JOIN Users u ON u.Id=p.UserId JOIN Roles r ON r.Id=u.RoleId WHERE r.Name='Vendor' AND u.IsActive=1 AND p.ReviewStatus='Approved' ORDER BY p.Id")
        assert owned, 'An active Vendor with an approved POI is required'
        token = actor.set({'id': owned['UserId'], 'role': 'Vendor', 'username': 'rollback-audit'})
        try:
            before = public.get_poi(owned['Id'], 'vi')
            canonical = repo.get_row('pois', owned['Id'], True)
            management.update_resource('pois', owned['Id'], {'Category': 'ROLLBACK-PENDING-CATEGORY'})
            assert repo.latest('pois', owned['Id'])['Status'] == 'Pending'
            assert repo.get_row('pois', owned['Id'], True)['Category'] == canonical['Category']
            assert public.get_poi(owned['Id'], 'vi') == before, 'Pending changed public data'
            print('Existing public POI remains unchanged while Vendor proposal is Pending: PASS')
            translation = repo.fetchone("SELECT TOP 1 Id FROM POITranslations WHERE POIId=%s AND LanguageCode='vi' AND ReviewStatus='Approved' AND IsDeleted=0", (owned['Id'],))
            if translation:
                management.update_resource('poi-translations', translation['Id'], {'Name': 'ROLLBACK-PENDING-NAME'})
                assert public.get_poi(owned['Id'], 'vi') == before
                print('Pending Vietnamese translation does not replace the public name: PASS')
            created = management.create_resource('pois', {'Code': 'AUDIT-' + uuid.uuid4().hex[:12],
                'Name': 'Temporary rollback POI', 'Latitude': 10, 'Longitude': 106, 'RadiusMeters': 50, 'IsActive': True})
            try:
                public.get_poi(created['Id'], 'vi')
            except HTTPException as error:
                assert error.status_code == 404
            else:
                raise AssertionError('New Pending POI leaked to Mobile')
            print('New Vendor POI is Pending and invisible to Mobile: PASS')
            with tempfile.TemporaryDirectory(prefix='audiotour-pending-') as folder:
                temporary_settings = replace(settings, media_root=folder)
                sample = io.BytesIO()
                with wave.open(sample, 'wb') as audio:
                    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(8000)
                    audio.writeframes(b'\0\0' * 8000)
                sample.seek(0)
                file = UploadFile(filename='rollback-check.wav', file=sample, headers=Headers({'content-type': 'audio/wav'}))
                with patch('app.services.review_service.settings', temporary_settings), patch('app.services.admin_service.settings', temporary_settings):
                    media = management.upload_media(file, owned['Id'], None, owned['UserId'])
                    track = management.create_resource('audio', {'POIId': owned['Id'], 'LanguageCode': 'vi',
                        'Title': 'Temporary rollback audio', 'AudioType': 'prerecorded', 'FileUrl': media['RelativePath']})
                assert media['ReviewStatus'] == track['ReviewStatus'] == 'Pending'
                assert track['MimeType'] == 'audio/wav' and track['FileSizeBytes'] > 44
                assert public.get_poi(owned['Id'], 'vi') == before
                try:
                    public.stream_audio_info(track['Id'], None)
                except HTTPException as error:
                    assert error.status_code == 404
                else:
                    raise AssertionError('Pending audio can be streamed')
                assert repo.latest('media', media['Id'])['Status'] == 'Pending'
                assert repo.latest('audio', track['Id'])['Status'] == 'Pending'
                print('Actual upload creates Pending MediaFiles + AudioTracks; neither is public: PASS')
            other = repo.fetchone("SELECT TOP 1 Id FROM POIs WHERE UserId IS NOT NULL AND UserId<>%s AND DeletedAt IS NULL", (owned['UserId'],))
            if other:
                try:
                    management.get_resource('pois', other['Id'])
                except HTTPException as error:
                    assert error.status_code == 404
                else:
                    raise AssertionError('Vendor accessed another owner POI')
                print('Vendor cannot access another owner POI: PASS')
        finally:
            connection.rollback()
            actor.reset(token)
        # Read again after rollback to prove none of the audit proposals persisted.
        assert public.get_poi(owned['Id'], 'vi') == before
        assert repo.scalar('SELECT COUNT(*) FROM POIs WHERE Id=%s', (created['Id'],)) == 0
        assert repo.scalar('SELECT COUNT(*) FROM AudioTracks WHERE Id=%s', (track['Id'],)) == 0
        assert repo.scalar('SELECT COUNT(*) FROM MediaFiles WHERE Id=%s', (media['Id'],)) == 0
        print('Rollback verified; no test POI, media or track persisted. No approval was performed: PASS')


if __name__ == '__main__':
    main()
