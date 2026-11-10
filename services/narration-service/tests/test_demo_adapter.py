import json
import os
import subprocess
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.config import LANGUAGES, Settings
from app.demo_worker import split_text
from app.main import create_app
from app.store import Store


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(provider='demo', demo_enabled=True, adapter_token='test-internal',
                                 cache_path=Path(self.temp.name) / 'cache.sqlite3')
        self.payload = {'text': 'Xin chào', 'name': 'Vĩnh Khánh', 'sourceLanguage': 'vi', 'targetLanguage': 'en'}
        self.headers = {'Authorization': 'Bearer test-internal', 'Idempotency-Key': 'demo-1-v1-en'}
        self.client = TestClient(create_app(self.settings))

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def result(self, audio=False, code=0):
        return subprocess.CompletedProcess([], code, stdout=b'ID3test-audio' if audio else
            json.dumps({'text': 'Hello', 'name': 'Vinh Khanh'}).encode(), stderr=b'private upstream details')

    def test_persistent_cache_replays_without_provider_after_restart(self):
        with patch('app.demo.subprocess.run', return_value=self.result()) as run:
            first = self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(first.json()['text'], 'Hello')
            self.client.close()
            self.client = TestClient(create_app(self.settings))
            replay = self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(replay.headers['X-Idempotent-Replay'], 'true')
            self.assertEqual(run.call_count, 1)
            conflict = self.client.post('/translate', json={**self.payload, 'text': 'Changed'}, headers=self.headers)
            self.assertEqual(conflict.status_code, 409)

    def test_six_locales_return_mp3_and_replay(self):
        with patch('app.demo.subprocess.run', return_value=self.result(audio=True)) as run:
            for code in LANGUAGES:
                headers = {**self.headers, 'Idempotency-Key': 'demo-tts-' + code}
                payload = {'text': 'Demo', 'languageCode': code, 'voice': LANGUAGES[code][1]}
                response = self.client.post('/tts', json=payload, headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers['content-type'], 'audio/mpeg')
                self.assertEqual(response.content, b'ID3test-audio')
                self.assertEqual(self.client.post('/tts', json=payload, headers=headers).headers['X-Idempotent-Replay'], 'true')
            self.assertEqual(run.call_count, 6)

    def test_disabled_auth_and_invalid_voice_never_call_provider(self):
        with patch('app.demo.subprocess.run') as run:
            self.assertEqual(self.client.post('/translate', json=self.payload).status_code, 401)
            self.assertEqual(self.client.post('/tts', json={'text': 'Hello', 'languageCode': 'vi', 'voice': 'en-US-AriaNeural'}, headers=self.headers).status_code, 422)
            self.client.close()
            self.client = TestClient(create_app(replace(self.settings, demo_enabled=False)))
            response = self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(response.status_code, 503)
            self.assertIn('NARRATION_DEMO_ENABLED', response.text)
            run.assert_not_called()

    def test_invalid_audio_and_rate_limit_are_not_cached_as_success(self):
        with patch('app.demo.subprocess.run', return_value=self.result()):
            response = self.client.post('/tts', json={'text': 'Hello', 'languageCode': 'en'}, headers=self.headers)
            self.assertEqual(response.status_code, 502)
        with patch('app.demo.subprocess.run', return_value=self.result(code=4)) as run:
            response = self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers['Retry-After'], '60')
            self.assertNotIn('private upstream', response.text)
            self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(run.call_count, 1)

    def test_timeout_is_bounded_and_retryable(self):
        with patch('app.demo.subprocess.run', side_effect=subprocess.TimeoutExpired('worker', 75)):
            response = self.client.post('/translate', json=self.payload, headers=self.headers)
            self.assertEqual(response.status_code, 504)
            self.assertEqual(response.headers['X-Adapter-Retryable'], 'true')

    def test_empty_speech_is_reported_as_retryable_not_success(self):
        with patch('app.demo.subprocess.run', return_value=self.result(code=5)):
            response = self.client.post('/tts', json={'text': 'Hello', 'languageCode': 'en'}, headers=self.headers)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['error']['code'], 'DemoNoAudio')
            self.assertEqual(response.headers['X-Adapter-Retryable'], 'true')

    def test_long_unicode_text_keeps_all_content(self):
        for text in ('Xin chào. ' * 1000, '你好世界' * 2400):
            chunks = split_text(text)
            self.assertEqual(''.join(chunks), text)
            self.assertTrue(all(len(x) <= 4500 for x in chunks))

    def test_environment_selects_demo_without_google_or_azure_keys(self):
        with patch.dict(os.environ, {'NARRATION_PROVIDER': 'demo', 'NARRATION_DEMO_ENABLED': 'true'}, clear=True):
            settings = Settings.from_env()
            self.assertEqual(settings.provider, 'demo')
            self.assertEqual(settings.missing('translate'), [])
            self.assertEqual(settings.missing('tts'), [])
            os.environ['DEMO_TTS_VOICES_JSON'] = '{"vi":"en-US-AriaNeural"}'
            with self.assertRaises(RuntimeError):
                Settings.from_env()

    def test_no_audio_retries_once_without_concatenating_partial_attempts(self):
        import asyncio
        from app.demo_worker import speech
        from edge_tts.exceptions import NoAudioReceived
        attempts = []
        class Communication:
            def __init__(self, *args, **kwargs):
                self.attempt = len(attempts)
                attempts.append(self)
            async def stream(self):
                if self.attempt == 0:
                    yield {'type': 'audio', 'data': b'partial'}
                    raise NoAudioReceived('temporary')
                yield {'type': 'audio', 'data': b'ID3complete'}
        with patch('edge_tts.Communicate', Communication), patch('app.demo_worker.asyncio.sleep', new_callable=AsyncMock):
            self.assertEqual(asyncio.run(speech({'text': 'Hello', 'voice': 'en-US-AriaNeural'})), b'ID3complete')
        self.assertEqual(len(attempts), 2)
