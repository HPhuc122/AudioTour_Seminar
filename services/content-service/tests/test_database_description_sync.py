"""SQL integration; external translation/TTS is replaced by an explicit fixture."""
from pathlib import Path
from unittest.mock import Mock, patch

from app.core.config import settings
from app.services.database_description_sync import reconcile_startup
from app.services.narration_jobs import NarrationJobs, NarrationWorker
from test_narration_jobs import wav_bytes
from test_review_sqlserver import SqlReviewTests


class ProviderFixture:
    def render(self, job):
        text = job['SourceText'] if job['LanguageCode'] == job['SourceLanguage'] else job['SourceText'] + ' [' + job['LanguageCode'] + ']'
        return text, job['SourceName'], wav_bytes(), 'audio/wav', '.wav'


class DatabaseDescriptionSyncTests(SqlReviewTests):
    def setUp(self):
        super().setUp()
        self.approve(self.poi['SubmissionId'])
        self.repo.execute('UPDATE POIs SET Description=%s WHERE Id=%s', ('Vietnamese fallback', self.poi['Id']))
        with self.as_user():
            draft = self.service.create_resource('narrations', {'PoiId': self.poi['Id'],
                'Title': 'Source narrative', 'LanguageCode': 'vi', 'TextContent': 'Initial VI'})
        self.approve(draft['SubmissionId'])
        self.worker = NarrationJobs(self.repo, ProviderFixture())
        self.finish()

    def tearDown(self):
        for item in self.repo.fetchall('SELECT RelativePath FROM MediaFiles WHERE PoiId=%s', (self.poi['Id'],)):
            self.files.append(Path(settings.media_root) / item['RelativePath'])
        super().tearDown()

    def finish(self):
        for _ in range(30):
            if not self.worker.process_one(self.poi['Id']):
                return
        self.fail('Fixture queue did not drain')

    def edit(self, language, text):
        self.repo.execute('UPDATE POITranslations SET Description=%s WHERE POIId=%s AND LanguageCode=%s',
                          (text, self.poi['Id'], language))

    def sync(self):
        return reconcile_startup(self.repo, self.poi['Id'])[0]

    def jobs(self):
        return self.repo.fetchall('SELECT * FROM NarrationJobs WHERE PoiId=%s ORDER BY Id', (self.poi['Id'],))

    def public(self, language):
        response = self.client.get(f"/api/v1/public/pois/{self.poi['Id']}?lang={language}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    def test_single_english_edit_updates_all_text_audio_without_review(self):
        before = self.public('en')
        old_jobs = len(self.jobs())
        self.edit('en', 'New English source')
        result = self.sync()
        self.assertEqual(result['sourceLanguage'], 'en')
        self.assertFalse(result['fallback'])
        self.assertEqual(self.public('en')['description'], before['description'])
        new = self.jobs()[old_jobs:]
        self.assertEqual(len(new), old_jobs)
        self.assertTrue(all(j['SourceLanguage'] == 'en' and j['SourceText'] == 'New English source' for j in new))
        self.assertEqual(self.repo.scalar("SELECT COUNT(*) FROM ContentSubmissions WHERE EntityId=%s AND Resource='narrations' AND Status='Pending'", (new[0]['NarrationId'],)), 0)
        self.finish()
        for j in new:
            value = self.public(j['LanguageCode'])
            expected = 'New English source' + ('' if j['LanguageCode'] == 'en' else ' [' + j['LanguageCode'] + ']')
            self.assertEqual(value['description'], expected)
            self.assertEqual(value['shortDescription'], expected)
            self.assertTrue(value['narration']['ready'])
            self.assertEqual(value['audioTracks'][0]['title'], before['name'])
        self.assertNotEqual(self.public('en')['audioTracks'][0]['audioTrackId'], before['audioTracks'][0]['audioTrackId'])

    def test_multiple_edits_use_poi_vietnamese_fallback(self):
        self.edit('en', 'English edit')
        self.edit('fr', 'French edit')
        result = self.sync()
        self.assertEqual(result['sourceLanguage'], 'vi')
        self.assertTrue(result['fallback'])
        self.finish()
        self.assertEqual(self.public('vi')['description'], 'Vietnamese fallback')
        self.assertEqual(self.public('en')['description'], 'Vietnamese fallback [en]')

    def test_no_change_and_restarts_do_not_create_jobs(self):
        count = len(self.jobs())
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.edit('en', 'Restarted source')
        self.sync()
        after = len(self.jobs())
        self.assertEqual(after, 2 * count)
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.worker.process_one(self.poi['Id'])
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.assertEqual(len(self.jobs()), after)
        self.finish()
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.assertEqual(len(self.jobs()), after)

    def test_edit_during_generation_is_not_overwritten(self):
        before = self.public('vi')['description']
        self.edit('en', 'First edit')
        self.sync()
        self.edit('en', 'A later edit')
        self.finish()
        self.assertEqual(self.public('vi')['description'], before)
        current = self.repo.scalar("SELECT Description FROM POITranslations WHERE POIId=%s AND LanguageCode='en'", (self.poi['Id'],))
        self.assertEqual(current, 'A later edit')
        self.assertEqual(self.sync()['sourceLanguage'], 'en')
        self.finish()
        self.assertEqual(self.public('en')['description'], 'A later edit')

    def test_empty_fallback_blocks_without_replacing_publication(self):
        count = len(self.jobs())
        self.edit('en', 'One')
        self.edit('fr', 'Two')
        self.repo.execute('UPDATE POIs SET Description=NULL WHERE Id=%s', (self.poi['Id'],))
        self.assertEqual(self.sync()['status'], 'blocked')
        self.assertEqual(len(self.jobs()), count)
        self.assertEqual(self.public('vi')['description'], 'Initial VI')

    def test_sync_only_claim_does_not_take_regular_review_jobs(self):
        self.assertFalse(self.worker.process_one(self.poi['Id'], database_sync_only=True))
        self.edit('en', 'Automatic source')
        self.sync()
        self.assertTrue(self.worker.process_one(self.poi['Id'], database_sync_only=True))

    def test_fallback_reuses_versioned_narrative_without_requeue_on_restart(self):
        self.edit('en', 'Edited English')
        self.edit('fr', 'Edited French')
        self.sync()
        count = len(self.jobs())
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.worker.process_one(self.poi['Id'])
        self.assertEqual(self.sync()['status'], 'unchanged')
        self.assertEqual(len(self.jobs()), count)
        self.finish()
        self.assertEqual(self.sync()['status'], 'unchanged')

    def test_retry_failed_batch_and_preserve_later_target_edit(self):
        self.edit('en', 'Source one')
        self.sync()
        self.repo.execute("UPDATE NarrationJobs SET Status='Failed' WHERE PoiId=%s AND Status='Queued'", (self.poi['Id'],))
        self.sync()
        self.assertEqual(self.repo.scalar("SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s AND Status='Failed'", (self.poi['Id'],)), 0)
        self.edit('fr', 'New direct French edit')
        self.finish()
        self.assertEqual(self.repo.scalar("SELECT Description FROM POITranslations WHERE POIId=%s AND LanguageCode='fr'", (self.poi['Id'],)), 'New direct French edit')

    def test_worker_scans_once_and_processes_sync_with_manual_automation_off(self):
        self.edit('en', 'Startup English input')
        worker = NarrationWorker()
        stopped = [False]
        worker.stop_event = Mock()
        worker.stop_event.is_set.side_effect = lambda: stopped[0]
        worker.stop_event.wait.side_effect = lambda seconds: stopped.__setitem__(0, True)
        with patch('app.services.narration_jobs.NarrationJobs', return_value=self.worker), \
             patch('app.services.narration_jobs.configuration', return_value={'automatic': False}), \
             patch('app.services.database_description_sync.enabled', return_value=True), \
             patch('app.services.database_description_sync.reconcile_startup', side_effect=lambda repo: reconcile_startup(repo, self.poi['Id'])) as scan:
            worker.loop()
        self.assertEqual(scan.call_count, 1)
        self.assertEqual(self.public('en')['description'], 'Startup English input')
