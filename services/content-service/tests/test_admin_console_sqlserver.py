"""SQL Server integration, all business writes are rolled back."""
import io
import os
import wave
import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
from app.api import admin_console as console, admin_automation as automation
from app.core.config import settings
import test_review_sqlserver as fixtures


@unittest.skipUnless(os.getenv('AUDIOTOUR_SQL_TESTS') == '1', 'Opt-in SQL Server integration')
class ConsoleTests(unittest.TestCase):
    headers = fixtures.SqlReviewTests.headers
    as_user = fixtures.SqlReviewTests.as_user
    approve = fixtures.SqlReviewTests.approve

    def setUp(self):
        fixtures.SqlReviewTests.setUp(self)
        self.extra_patches = [patch.object(console, 'service', self.service), patch.object(automation, 'service', self.service)]
        for p in self.extra_patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.extra_patches):
            p.stop()
        fixtures.SqlReviewTests.tearDown(self)

    def test_catalog_search_pagination_status_scope(self):
        r = self.client.get('/api/v1/cms/catalog/pois?search=INTEGRATION&pageSize=1', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['data']['total'], 1)
        self.assertEqual(r.json()['data']['items'][0]['Id'], self.poi['Id'])
        r = self.client.get('/api/v1/cms/catalog/pois?search=INTEGRATION&pageSize=1', headers=self.headers(1, 'Admin'))
        self.assertEqual(r.json()['data']['total'], 2)
        r = self.client.get('/api/v1/cms/catalog/pois?search=%25_%27&pageSize=1', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.approve(self.poi['SubmissionId'])
        with self.as_user():
            self.service.update_resource('pois', self.poi['Id'], {'Name': 'Proposal-only title'})
        r = self.client.get('/api/v1/cms/catalog/pois?status=Pending&search=Proposal-only', headers=self.headers())
        self.assertEqual(r.json()['data']['total'], 1)
        with self.as_user():
            self.assertEqual(self.repo.get_row('pois', self.poi['Id'])['Name'], 'Original public name')

    def test_privileged_pages_and_no_password_leak(self):
        for path in ('catalog/users', 'vendors', 'transactions', 'validity', 'capabilities', 'automation/status', 'catalog/languages'):
            r = self.client.get('/api/v1/cms/' + path, headers=self.headers())
            self.assertEqual(r.status_code, 403, (path, r.text))
        r = self.client.get('/api/v1/cms/catalog/users?pageSize=1', headers=self.headers(1, 'Admin'))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn('PasswordHash', r.text)
        self.assertNotIn('RefreshToken', r.text)

    def test_review_dossier_is_canonical_and_immutable_proposal(self):
        initial = self.client.get('/api/v1/cms/review-queue?resource=pois&search=Original%20public', headers=self.headers())
        self.assertEqual(initial.status_code, 200, initial.text)
        self.assertEqual(initial.json()['data']['total'], 1)
        self.approve(self.poi['SubmissionId'])
        with self.as_user():
            changed = self.service.update_resource('pois', self.poi['Id'], {'Name': 'Changed proposal'})
        r = self.client.get('/api/v1/cms/review-queue?resource=pois&search=Changed', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['data']['total'], 1)
        r = self.client.get(f"/api/v1/cms/review-dossier/{changed['SubmissionId']}", headers=self.headers())
        data = r.json()['data']
        self.assertEqual(data['canonical']['Name'], 'Original public name')
        self.assertEqual(data['proposed']['Name'], 'Changed proposal')
        self.assertEqual(self.client.get(f"/api/v1/cms/review-dossier/{self.other['SubmissionId']}", headers=self.headers()).status_code, 404)

    def test_validity_is_staged_and_dates_validated(self):
        self.approve(self.poi['SubmissionId'])
        path = f"/api/v1/cms/validity/{self.poi['Id']}"
        invalid = {'validFrom': '2027-02-01T00:00:00Z', 'validUntil': '2027-01-01T00:00:00Z'}
        self.assertEqual(self.client.put(path, headers=self.headers(1, 'Admin'), json=invalid).status_code, 422)
        valid = {'validFrom': '2027-01-01T07:00:00+07:00', 'validUntil': '2027-02-01T00:00:00Z'}
        r = self.client.put(path, headers=self.headers(1, 'Admin'), json=valid)
        self.assertEqual(r.status_code, 200, r.text)
        with self.as_user(1, 'Admin'):
            self.assertIsNone(self.repo.get_row('pois', self.poi['Id'])['ValidUntil'])
        self.approve(r.json()['data']['SubmissionId'])
        with self.as_user(1, 'Admin'):
            self.assertEqual(self.repo.get_row('pois', self.poi['Id'])['ValidFrom'], datetime(2027, 1, 1))

    def test_payment_cannot_be_confirmed_without_evidence(self):
        self.approve(self.poi['SubmissionId'])
        r = self.client.post(f"/api/v1/pois/{self.poi['Id']}/mark-paid", headers=self.headers(1, 'Admin'))
        self.assertEqual(r.status_code, 409, r.text)
        r = self.client.put(f"/api/v1/pois/{self.poi['Id']}", headers=self.headers(1, 'Admin'), json={'PaymentStatus': 2})
        self.assertEqual(r.status_code, 403, r.text)
        for kind in ('poi', 'access'):
            r = self.client.get('/api/v1/cms/transactions?kind=' + kind, headers=self.headers(1, 'Admin'))
            self.assertEqual(r.status_code, 200, r.text)
            for row in r.json()['data']['items']:
                self.assertTrue(row['EvidenceStatus'])

    def test_languages_validation_and_duplicate(self):
        payload = {'Code': 'zz-test', 'Name': 'Test language', 'NativeName': 'Test', 'SortOrder': 9, 'IsActive': True}
        r = self.client.post('/api/v1/cms/languages', headers=self.headers(1, 'Admin'), json=payload)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.client.post('/api/v1/cms/languages', headers=self.headers(1, 'Admin'), json=payload).status_code, 409)
        payload['Code'] = 'another'
        self.assertEqual(self.client.put('/api/v1/cms/languages/zz-test', headers=self.headers(1, 'Admin'), json=payload).status_code, 422)
        r = self.client.get('/api/v1/cms/catalog/languages', headers=self.headers(1, 'Admin'))
        self.assertEqual(r.status_code, 200, r.text)

    def test_automation_rejects_pending_and_reports_missing_configuration(self):
        with self.as_user():
            narration = self.service.create_resource('narrations', {'PoiId': self.poi['Id'], 'Title': 'Original', 'LanguageCode': 'vi', 'TextContent': 'Approved source'})
        path = f"/api/v1/cms/automation/narrations/{narration['Id']}"
        self.assertEqual(self.client.post(path, headers=self.headers(1, 'Admin'), json={}).status_code, 409)
        self.approve(narration['SubmissionId'])
        with patch.dict(os.environ, {'ADMIN_TTS_URL': '', 'ADMIN_TRANSLATION_URL': ''}):
            response = self.client.get('/api/v1/cms/automation/status', headers=self.headers())
            self.assertIn('ADMIN_TTS_URL', response.json()['data']['missingConfiguration'])
            self.assertEqual(self.client.post(path, headers=self.headers(1, 'Admin'), json={}).status_code, 200)

    def test_automation_reenqueue_does_not_duplicate_jobs(self):
        with self.as_user():
            narration = self.service.create_resource('narrations', {'PoiId': self.poi['Id'], 'Title': 'Original', 'LanguageCode': 'vi', 'TextContent': 'Approved source'})
        self.approve(narration['SubmissionId'])
        count = self.repo.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s', (self.poi['Id'],))
        path = f"/api/v1/cms/automation/narrations/{narration['Id']}"
        response = self.client.post(path, headers=self.headers(1, 'Admin'), json={})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.repo.scalar('SELECT COUNT(*) FROM NarrationJobs WHERE PoiId=%s', (self.poi['Id'],)), count)

    def test_statistics_range_validation_and_summary(self):
        r = self.client.get('/api/v1/cms/statistics?startDate=2027-01-01&endDate=2026-01-01', headers=self.headers())
        self.assertEqual(r.status_code, 422)
        r = self.client.get('/api/v1/cms/statistics', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn('durationSeconds', r.json()['data']['summary'])
        r = self.client.get('/api/v1/cms/console-summary', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
