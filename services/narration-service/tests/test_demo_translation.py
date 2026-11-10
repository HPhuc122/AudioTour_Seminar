import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.demo_translation import split_utf8, translate_mymemory
from app.errors import AdapterError
from app.main import create_app


class TranslationTests(unittest.TestCase):
    payload = {'text': 'Chào mừng bạn đến Vĩnh Khánh.', 'name': 'Vĩnh Khánh',
               'sourceLanguage': 'vi', 'targetLanguage': 'en'}

    def test_split_preserves_multibyte_text_and_word_boundaries(self):
        for text in ('Chào bạn. ' * 250, '你好世界' * 200, '🍜' * 300):
            chunks = split_utf8(text)
            self.assertEqual(''.join(chunks), text)
            self.assertTrue(all(len(x.encode('utf-8')) <= 500 for x in chunks))

    def test_https_language_mapping_and_html_decoding(self):
        calls = []
        def dispatch(request):
            calls.append(request)
            self.assertEqual(request.url.scheme, 'https')
            self.assertEqual(request.url.params['langpair'], 'vi-VN|en-GB')
            self.assertLessEqual(len(request.url.params['q'].encode('utf-8')), 500)
            return httpx.Response(200, json={'responseStatus': 200, 'responseData': {'translatedText': 'Welcome &amp; enjoy'}})
        with httpx.Client(transport=httpx.MockTransport(dispatch)) as client:
            result = translate_mymemory(self.payload, client)
        self.assertEqual(result, {'text': 'Welcome & enjoy', 'name': 'Welcome & enjoy'})
        self.assertEqual(len(calls), 2)

    def test_quota_error_in_http_200_is_not_saved_as_translation(self):
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={
            'responseStatus': 429, 'quotaFinished': True,
            'responseData': {'translatedText': 'QUOTA EXCEEDED WARNING'},
        }))) as client:
            with self.assertRaises(AdapterError) as error:
                translate_mymemory(self.payload, client)
        self.assertEqual(error.exception.code, 'DemoQuotaExceeded')
        self.assertEqual(error.exception.retry_after, 86400)

    def test_bad_status_and_missing_data_do_not_return_success(self):
        for body in ({'responseStatus': 400}, {'responseStatus': 200, 'responseData': {}},
                     {'responseStatus': 200, 'responseData': {'translatedText': ''}}):
            with self.subTest(body=body), httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=body))) as client:
                with self.assertRaises(AdapterError):
                    translate_mymemory(self.payload, client)

    def test_persistent_cooldown_blocks_new_jobs_but_serves_cached_results(self):
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            settings = Settings(provider='demo', demo_enabled=True, adapter_token='test-token', cache_path=Path(tmp) / 'cache.sqlite3')
            headers = {'Authorization': 'Bearer test-token', 'Idempotency-Key': 'ok-key'}
            success = subprocess.CompletedProcess([], 0, stdout=json.dumps({'text': 'Welcome', 'name': 'Name'}).encode(), stderr=b'')
            with TestClient(create_app(settings)) as client, patch('app.demo.subprocess.run', return_value=success) as run:
                self.assertEqual(client.post('/translate', json=self.payload, headers=headers).status_code, 200)
                run.return_value = subprocess.CompletedProcess([], 6, stdout=b'', stderr=b'')
                self.assertEqual(client.post('/translate', json=self.payload, headers={**headers, 'Idempotency-Key': 'quota-key'}).status_code, 429)
                self.assertEqual(run.call_count, 2)
            with TestClient(create_app(settings)) as client, patch('app.demo.subprocess.run') as run:
                error = client.post('/translate', json=self.payload, headers={**headers, 'Idempotency-Key': 'new-key'})
                self.assertEqual(error.status_code, 429)
                self.assertGreater(int(error.headers['Retry-After']), 86000)
                cached = client.post('/translate', json=self.payload, headers=headers)
                self.assertEqual(cached.headers['X-Idempotent-Replay'], 'true')
                run.assert_not_called()
