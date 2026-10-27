"""Selected SQL rollback tests. Provider fixtures never make external requests."""
import io
import wave
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.core.config import settings
from app.services.narration_jobs import NarrationJobs, enqueue
from app.services.narration_provider import ProviderFailure
from test_review_sqlserver import SqlReviewTests


def wav_bytes():
    output = io.BytesIO()
    with wave.open(output, 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(8000)
        stream.writeframes(b'\0\0' * 80)
    return output.getvalue()


class FixtureProvider:
    """Explicit test-only provider. Not installed in any running service."""
    def render(self, job):
        return (job['SourceText'] + ':' + job['LanguageCode'], job['SourceName'], wav_bytes(), 'audio/wav', '.wav')


class NarrationJobsTests(SqlReviewTests):
    def setUp(self):
        super().setUp()
        from app.api import admin_automation
        automation_patch = patch.object(admin_automation, 'service', self.service)
        automation_patch.start()
        self.patches.append(automation_patch)
        self.approve(self.poi['SubmissionId'])
        self.worker = NarrationJobs(self.repo, FixtureProvider())

    def tearDown(self):
        # Real generated test bytes are removed before rolling back their rows.
        for row in self.repo.fetchall('SELECT RelativePath AS FileUrl FROM MediaFiles WHERE PoiId=%s', (self.poi['Id'],)):
            if row.get('FileUrl'):
                self.files.append(Path(settings.media_root) / row['FileUrl'])
        super().tearDown()

    def narration(self, text='approved version one', source_language='vi'):
        with self.as_user():
            item = self.service.create_resource('narrations', {
                'PoiId': self.poi['Id'], 'Title': 'Job test narrative',
                'LanguageCode': source_language, 'TextContent': text,
            })
        self.approve(item['SubmissionId'])
        return item

    def finish(self):
        for _ in range(30):
            if not self.worker.process_one(self.poi['Id']):
                break

    def public(self, language='vi'):
        response = self.client.get(f"/api/v1/public/pois/{self.poi['Id']}?lang={language}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    def test_atomic_approval_enqueue_snapshot_and_no_duplicates(self):
        item = self.narration()
        jobs = self.repo.fetchall('SELECT * FROM NarrationJobs WHERE PoiId=%s', (self.poi['Id'],))
        self.assertEqual(len(jobs), self.repo.scalar('SELECT COUNT(*) FROM Languages WHERE IsActive=1'))
        self.assertTrue(all(j['Status'] == 'Queued' and j['SourceText'] == 'approved version one' for j in jobs))
        self.assertFalse(self.public()['narration']['ready'])
        with self.as_user(1, 'Admin'):
            source = self.repo.get_row('narrations', item['Id'])
            enqueue(self.repo, source, item['SubmissionId'], 1)
        self.assertEqual(self.repo.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s', (self.poi['Id'],)), len(jobs))
        with self.as_user():
            self.service.update_resource('narrations', item['Id'], {'TextContent': 'unapproved edit'})
        self.finish()
        self.assertEqual(self.public()['description'], 'approved version one:vi')

    def test_one_approval_publishes_each_language_with_audio(self):
        self.narration()
        self.finish()
        for row in self.repo.fetchall('SELECT Code FROM Languages WHERE IsActive=1'):
            data = self.public(row['Code'])
            self.assertTrue(data['narration']['ready'])
            self.assertEqual(data['description'], 'approved version one:' + row['Code'])
            self.assertEqual(len(data['audioTracks']), 1)
            track = data['audioTracks'][0]
            self.assertTrue(track['isAvailable'])
            self.assertNotIn('fileUrl', track)
            self.assertIn('streamUrl', track)
        self.assertEqual(self.repo.scalar("SELECT COUNT(*) FROM ContentSubmissions WHERE Resource IN ('media','audio','poi-translations') AND EntityId IN (SELECT AudioTrackId FROM NarrationJobs WHERE PoiId=%s)", (self.poi['Id'],)), 0)
        with self.as_user(1, 'Admin'):
            self.service.create_resource('qr', {'Code': 'AUTO-JOB-TEST', 'PoiId': self.poi['Id'], 'IsActive': True, 'RequiresPayment': False, 'AccessDurationMinutes': 60})
        access = self.client.post('/api/v1/public/access/start-target', json={'targetType': 'poi', 'targetId': self.poi['Id']})
        self.assertEqual(access.status_code, 200, access.text)
        headers = {'X-Guest-Access-Token': access.json()['data']['accessToken']}
        detail = self.client.get(f"/api/v1/public/audio-tour/pois/{self.poi['Id']}?languageCode=vi", headers=headers)
        self.assertEqual(detail.status_code, 200, detail.text)
        stream = self.client.get(self.public()['audioTracks'][0]['streamUrl'], headers=headers)
        self.assertEqual(stream.status_code, 200, stream.text)
        self.assertEqual(stream.content, wav_bytes())

    def test_new_version_retains_old_pair_until_success_and_fences_old_job(self):
        item = self.narration()
        old_job = self.worker.claim(self.poi['Id'])
        self.repo.execute("UPDATE NarrationJobs SET Status='Queued',LeaseToken=NULL,LeaseUntil=NULL WHERE Id=%s", (old_job['Id'],))
        self.finish()
        old = self.public()
        with self.as_user():
            changed = self.service.update_resource('narrations', item['Id'], {'TextContent': 'approved version two'})
        self.approve(changed['SubmissionId'])
        self.assertEqual(self.public()['description'], old['description'])
        self.assertEqual(self.public()['audioTracks'][0]['id'], old['audioTracks'][0]['id'])
        with self.as_user(1, 'Admin'):
            self.assertFalse(self.worker.publish(old_job, 'stale', 'stale', 'does-not-exist.wav', 'audio/wav', 1))
        self.finish()
        self.assertEqual(self.public()['description'], 'approved version two:vi', self.repo.fetchall('SELECT Id,SourceVersion,Status,ErrorCode,ErrorMessage FROM NarrationJobs WHERE PoiId=%s', (self.poi['Id'],)))
        self.assertNotEqual(self.public()['audioTracks'][0]['id'], old['audioTracks'][0]['id'])

    def test_failure_retry_limits_lease_recovery_and_admin_retry(self):
        self.narration()
        self.worker.provider.render = lambda job: (_ for _ in ()).throw(ProviderFailure('ProviderUnavailable', 'temporary failure'))
        job = self.worker.claim(self.poi['Id'])
        self.repo.execute('UPDATE NarrationJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=%s', (job['Id'],))
        self.worker.recover()
        self.assertEqual(self.repo.fetchone('SELECT Status FROM NarrationJobs WHERE Id=%s', (job['Id'],))['Status'], 'Queued')
        for _ in range(4):
            self.worker.process_one(self.poi['Id'])
            self.repo.execute('UPDATE NarrationJobs SET AvailableAt=SYSUTCDATETIME() WHERE PoiId=%s', (self.poi['Id'],))
        for _ in range(20):
            self.worker.process_one(self.poi['Id'])
            self.repo.execute('UPDATE NarrationJobs SET AvailableAt=SYSUTCDATETIME() WHERE PoiId=%s', (self.poi['Id'],))
        failed = self.repo.fetchone('SELECT TOP 1 * FROM NarrationJobs WHERE PoiId=%s ORDER BY Id', (self.poi['Id'],))
        self.assertEqual(failed['Status'], 'Failed')
        self.assertEqual(failed['Attempts'], 3)
        response = self.client.post(f"/api/v1/cms/automation/jobs/{failed['Id']}/retry", headers=self.headers())
        self.assertEqual(response.status_code, 403)
        response = self.client.post(f"/api/v1/cms/automation/jobs/{failed['Id']}/retry", headers=self.headers(1, 'Admin'))
        self.assertEqual(response.status_code, 200, response.text)
        retried = self.repo.fetchone('SELECT * FROM NarrationJobs WHERE Id=%s', (failed['Id'],))
        self.assertEqual(retried['Attempts'], 0)
        self.assertEqual(retried['TotalAttempts'], 3)

    def test_status_scope_missing_config_and_missing_file_not_advertised(self):
        self.narration()
        response = self.client.get(f"/api/v1/cms/automation/status?poiId={self.poi['Id']}", headers=self.headers(13))
        self.assertEqual(response.status_code, 404)
        response = self.client.get(f"/api/v1/cms/automation/status?poiId={self.poi['Id']}", headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['data']['jobs'])
        self.finish()
        ready = self.public()
        track = self.repo.fetchone('SELECT FileUrl FROM AudioTracks WHERE Id=%s', (ready['audioTracks'][0]['id'],))
        (Path(settings.media_root) / track['FileUrl']).unlink()
        missing = self.public()
        self.assertFalse(missing['narration']['ready'])
        self.assertEqual(missing['audioTracks'], [])

    def test_missing_configuration_is_real_failure_without_http_call(self):
        from app.services.narration_provider import NarrationProvider
        self.narration()
        self.worker.provider = NarrationProvider()
        with patch.dict('os.environ', {'ADMIN_AUTOMATION_ENABLED': 'true', 'ADMIN_TTS_URL': '', 'ADMIN_TRANSLATION_URL': ''}), patch('httpx.Client') as client:
            self.worker.process_one(self.poi['Id'])
            client.assert_not_called()
        failed = self.repo.fetchone('SELECT TOP 1 * FROM NarrationJobs WHERE PoiId=%s ORDER BY Id', (self.poi['Id'],))
        self.assertEqual(failed['Status'], 'Failed')
        self.assertEqual(failed['ErrorCode'], 'MissingConfiguration')
        self.assertIn('ADMIN_TTS_URL', failed['ErrorMessage'])
        self.assertFalse(self.public()['narration']['ready'])

    def test_expired_worker_is_fenced_and_exhausted_lease_fails(self):
        self.narration()
        old = self.worker.claim(self.poi['Id'])
        self.repo.execute('UPDATE NarrationJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=%s', (old['Id'],))
        self.worker.recover()
        replacement = self.worker.claim(self.poi['Id'])
        self.assertEqual(old['Id'], replacement['Id'])
        self.assertNotEqual(old['LeaseToken'], replacement['LeaseToken'])
        with self.as_user(1, 'Admin'):
            self.assertFalse(self.worker.publish(old, 'stale', 'stale', 'missing.wav', 'audio/wav', 1))
        self.repo.execute('UPDATE NarrationJobs SET Attempts=MaxAttempts,LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=%s', (replacement['Id'],))
        NarrationJobs(self.repo).recover()
        row = self.repo.fetchone('SELECT Status FROM NarrationJobs WHERE Id=%s', (replacement['Id'],))
        self.assertEqual(row['Status'], 'Failed')

    def test_new_narration_fences_older_draft_and_retry(self):
        self.narration('old draft')
        old = self.worker.claim(self.poi['Id'])
        self.narration('new draft', source_language='en')
        with self.as_user(1, 'Admin'):
            self.assertFalse(self.worker.publish(old, 'stale', 'stale', 'missing.wav', 'audio/wav', 1))
            with self.assertRaises(HTTPException) as err:
                self.worker.retry(old['Id'])
            self.assertEqual(err.exception.status_code, 409)
        self.finish()
        self.assertEqual(self.public()['description'], 'new draft:vi')

    def test_generated_audio_keeps_manual_upload_review_and_soft_delete_history(self):
        item = self.narration()
        self.finish()
        media = self.upload('audio/wav', 'manual.wav', wav_bytes())
        with self.as_user():
            track = self.service.create_resource('audio', {'POIId': self.poi['Id'], 'LanguageCode': 'vi', 'AudioType': 'prerecorded', 'FileUrl': media['RelativePath'], 'MimeType': 'audio/wav', 'IsActive': True})
        self.assertEqual(track['ReviewStatus'], 'Pending')
        response = self.client.get(f"/api/v1/public/audio/{track['Id']}")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(self.public()['narration']['ready'])
        self.approve(media['SubmissionId'])
        self.approve(track['SubmissionId'])
        self.assertEqual(self.repo.scalar("SELECT COUNT(*) FROM AudioTracks WHERE POIId=%s AND LanguageCode='vi' AND IsActive=1", (self.poi['Id'],)), 2)
        with self.as_user():
            self.service.delete_resource('narrations', item['Id'])
            proposal = self.service.get_resource('narrations', item['Id'])
        self.approve(proposal['SubmissionId'])
        self.assertEqual(self.repo.scalar('SELECT COUNT(*) FROM NarrationDrafts WHERE Id=%s AND IsDeleted=1', (item['Id'],)), 1)
        self.assertEqual(self.repo.scalar('SELECT COUNT(*) FROM NarrationPublications WHERE PoiId=%s', (self.poi['Id'],)), 0)
        self.assertEqual(self.public()['audioTracks'][0]['id'], track['Id'])

    def test_provider_retry_after_is_not_shortened_by_worker_backoff(self):
        self.narration()
        job = self.worker.claim(self.poi['Id'])
        self.worker.fail(job, 'AzureRateLimited', 'Provider cooldown', True, retry_after=120)
        state = self.repo.fetchone('SELECT Status,DATEDIFF(second,SYSUTCDATETIME(),AvailableAt) AS delay FROM NarrationJobs WHERE Id=%s', (job['Id'],))
        self.assertEqual(state['Status'], 'Queued')
        self.assertGreaterEqual(state['delay'], 119)
        self.assertLessEqual(state['delay'], 121)
