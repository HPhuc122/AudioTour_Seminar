import json
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app.config import LANGUAGES, Settings
from app.main import create_app
from app.store import Store


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(enabled=True, adapter_token='internal-test-token',
            translator_key='fake-translation-key', translator_region='southeastasia',
            speech_key='fake-speech-key', speech_region='southeastasia',
            cache_path=Path(self.temp.name) / 'results.sqlite3')
        self.calls = []
        self.handler = self.success
        self.upstream = httpx.Client(transport=httpx.MockTransport(self.dispatch))
        self.store = Store(self.settings.cache_path)
        self.client = TestClient(create_app(self.settings, self.upstream, self.store))
        self.headers = {'Authorization': 'Bearer internal-test-token', 'Idempotency-Key': 'narration-1-v2-en'}
        self.translation = {'text': 'Original narration', 'name': 'Original name', 'sourceLanguage': 'vi', 'targetLanguage': 'en'}
        self.speech = {'text': 'Translated narration', 'languageCode': 'en', 'voice': None}

    def tearDown(self):
        self.client.close()
        self.upstream.close()
        self.temp.cleanup()

    def dispatch(self, request):
        self.calls.append(request)
        return self.handler(request)

    def success(self, request):
        if request.url.path.endswith('/translate'):
            target = request.url.params['to']
            return httpx.Response(200, json=[{'translations': [{'text': 'Translated narration', 'to': target}]}, {'translations': [{'text': 'Translated name', 'to': target}]}])
        return httpx.Response(200, content=b'ID3test-audio', headers={'content-type': 'audio/mpeg'})

    def test_auth_config_and_validation_never_call_azure(self):
        self.assertEqual(self.client.post('/translate', json=self.translation).status_code, 401)
        self.assertEqual(self.client.post('/translate', json=self.translation, headers={**self.headers, 'Authorization': 'Bearer wrong'}).status_code, 401)
        self.assertEqual(self.client.post('/translate', json=self.translation, headers={'Authorization': self.headers['Authorization']}).status_code, 422)
        self.assertEqual(self.client.post('/tts', json={**self.speech, 'languageCode': 'xx'}, headers=self.headers).status_code, 422)
        self.assertEqual(self.calls, [])

    def test_environment_voice_mapping_and_separate_internal_token(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ, {'NARRATION_ADAPTER_TOKEN': 'adapter-only', 'AZURE_TRANSLATOR_KEY': 'azure-only', 'AZURE_SPEECH_VOICES_JSON': '{"vi":"vi-VN-NamMinhNeural"}'}, clear=True):
            settings = Settings.from_env()
            self.assertEqual(settings.voices['vi'], 'vi-VN-NamMinhNeural')
            self.assertEqual(settings.voices['ja'], 'ja-JP-NanamiNeural')
            self.assertFalse(settings.enabled)
            os.environ['NARRATION_ADAPTER_TOKEN'] = 'azure-only'
            with self.assertRaises(RuntimeError):
                Settings.from_env()
            os.environ['NARRATION_ADAPTER_TOKEN'] = 'adapter-only'
            os.environ['AZURE_SPEECH_VOICES_JSON'] = '{"vi":"en-US-AriaNeural"}'
            with self.assertRaises(RuntimeError):
                Settings.from_env()
        blocked = TestClient(create_app(replace(self.settings, enabled=False), self.upstream, self.store))
        response = blocked.post('/tts', json=self.speech, headers=self.headers)
        blocked.close()
        self.assertEqual(response.status_code, 503)
        self.assertIn('NARRATION_AZURE_ENABLED', response.text)
        self.assertEqual(self.calls, [])

    def test_translation_contract_and_separate_credentials(self):
        response = self.client.post('/translate', json=self.translation, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'text': 'Translated narration', 'name': 'Translated name'})
        request = self.calls[0]
        self.assertEqual(json.loads(request.content), [{'Text': 'Original narration'}, {'Text': 'Original name'}])
        self.assertEqual(dict(request.url.params), {'api-version': '3.0', 'from': 'vi', 'to': 'en'})
        self.assertEqual(request.headers['Ocp-Apim-Subscription-Key'], 'fake-translation-key')
        self.assertEqual(request.headers['Ocp-Apim-Subscription-Region'], 'southeastasia')
        self.assertNotIn('authorization', request.headers)
        self.assertNotIn('internal-test-token', request.content.decode())

    def test_six_languages_and_ssml_escaping(self):
        for code, (translator, locale, voice) in LANGUAGES.items():
            with self.subTest(code=code):
                headers = {**self.headers, 'Idempotency-Key': 'language-' + code}
                result = self.client.post('/translate', json={**self.translation, 'targetLanguage': code}, headers=headers)
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(self.calls[-1].url.params['to'], translator)
                result = self.client.post('/tts', json={'text': 'A & B <break time="9s"/>', 'languageCode': code, 'voice': locale}, headers=headers)
                self.assertEqual(result.status_code, 200, result.text)
                request = self.calls[-1]
                self.assertIn(voice.encode(), request.content)
                self.assertIn(b'&lt;break', request.content)
                self.assertNotIn(b'<break', request.content)
                self.assertEqual(request.headers['Ocp-Apim-Subscription-Key'], 'fake-speech-key')

    def test_audio_bytes_and_format(self):
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['content-type'], 'audio/mpeg')
        self.assertEqual(response.content, b'ID3test-audio')
        self.assertEqual(self.calls[0].headers['X-Microsoft-OutputFormat'], 'audio-24khz-48kbitrate-mono-mp3')
        wav_settings = replace(self.settings, speech_format='riff-24khz-16bit-mono-pcm')
        self.handler = lambda request: httpx.Response(200, content=b'RIFF0000WAVEtest')
        wav = TestClient(create_app(wav_settings, self.upstream, self.store))
        response = wav.post('/tts', json=self.speech, headers={**self.headers, 'Idempotency-Key': 'wav-1'})
        wav.close()
        self.assertEqual(response.headers['content-type'], 'audio/wav')
        self.assertEqual(response.content, b'RIFF0000WAVEtest')

    def test_durable_replay_separate_operations_and_conflict(self):
        first = self.client.post('/translate', json=self.translation, headers=self.headers)
        self.assertEqual(first.status_code, 200)
        # Translation and TTS intentionally use the same key; namespaces differ.
        self.assertEqual(self.client.post('/tts', json=self.speech, headers=self.headers).status_code, 200)
        self.assertEqual(len(self.calls), 2)
        restarted = TestClient(create_app(self.settings, self.upstream, Store(self.settings.cache_path)))
        replay = restarted.post('/translate', json=self.translation, headers=self.headers)
        replay_audio = restarted.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(replay.content, first.content)
        self.assertEqual(replay_audio.content, b'ID3test-audio')
        self.assertEqual(replay.headers['X-Idempotent-Replay'], 'true')
        conflict = restarted.post('/translate', json={**self.translation, 'text': 'Changed'}, headers=self.headers)
        restarted.close()
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()['error']['code'], 'IdempotencyConflict')
        self.assertEqual(len(self.calls), 2)

    def test_429_retry_after_is_persisted_and_replayed_without_new_call(self):
        self.handler = lambda request: httpx.Response(429, headers={'Retry-After': '120'}, text='secret upstream body')
        first = self.client.post('/translate', json=self.translation, headers=self.headers)
        again = self.client.post('/translate', json=self.translation, headers=self.headers)
        self.assertEqual(first.status_code, 429)
        self.assertEqual(first.headers['Retry-After'], '120')
        self.assertGreaterEqual(int(again.headers['Retry-After']), 119)
        self.assertEqual(len(self.calls), 1)
        self.assertNotIn('secret upstream', first.text)
        with self.store.connection() as db:
            db.execute('UPDATE adapter_results SET retry_at=0')
        self.handler = self.success
        self.assertEqual(self.client.post('/translate', json=self.translation, headers=self.headers).status_code, 200)
        self.assertEqual(len(self.calls), 2)

    def test_http_date_retry_after_and_azure_auth_are_sanitized(self):
        self.handler = lambda request: httpx.Response(429, headers={'Retry-After': format_datetime(datetime.now(timezone.utc) + timedelta(seconds=120), usegmt=True)})
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertGreaterEqual(int(response.headers['Retry-After']), 119)
        self.handler = lambda request: httpx.Response(401, text='fake-speech-key: internal provider details')
        response = self.client.post('/tts', json=self.speech, headers={**self.headers, 'Idempotency-Key': 'auth-error'})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.headers['X-Adapter-Retryable'], 'false')
        self.assertEqual(response.json()['error']['code'], 'AzureAuthentication')
        self.assertNotIn('fake-speech-key', response.text)

    def test_read_timeout_is_uncertain_and_never_automatically_resent(self):
        def timeout(request):
            raise httpx.ReadTimeout('fake-speech-key sensitive exception', request=request)
        self.handler = timeout
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.headers['X-Adapter-Retryable'], 'false')
        self.assertNotIn('fake-speech-key', response.text)
        self.handler = self.success
        self.assertEqual(self.client.post('/tts', json=self.speech, headers=self.headers).status_code, 409)
        self.assertEqual(len(self.calls), 1)

    def test_processing_and_interrupted_requests_do_not_duplicate(self):
        owner, _ = self.store.begin('tts', self.headers['Idempotency-Key'], self.speech)
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 429)
        with self.store.connection() as db:
            db.execute('UPDATE adapter_results SET lease_until=0')
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.calls, [])

    def test_invalid_audio_is_not_saved_as_success_or_retried(self):
        self.handler = lambda request: httpx.Response(200, content=b'{"not":"audio"}')
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 502)
        self.handler = self.success
        self.assertEqual(self.client.post('/tts', json=self.speech, headers=self.headers).status_code, 409)
        self.assertEqual(len(self.calls), 1)

    def test_connection_failure_is_retryable_without_secret_leak(self):
        def unavailable(request):
            raise httpx.ConnectError('fake-speech-key private endpoint', request=request)
        self.handler = unavailable
        response = self.client.post('/tts', json=self.speech, headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['X-Adapter-Retryable'], 'true')
        self.assertNotIn('fake-speech-key', response.text)

    def test_concurrent_claims_have_one_owner(self):
        from concurrent.futures import ThreadPoolExecutor
        from app.errors import AdapterError
        def claim(_):
            try:
                owner, _ = Store(self.settings.cache_path).begin('tts', 'concurrent-key', self.speech)
                return bool(owner)
            except AdapterError as error:
                self.assertEqual(error.code, 'RequestInProgress')
                return False
        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertEqual(sum(pool.map(claim, range(8))), 1)

    def content_provider(self):
        import importlib.util
        path = Path(__file__).resolve().parents[3] / 'services/content-service/app/services/narration_provider.py'
        spec = importlib.util.spec_from_file_location('content_narration_provider_contract', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_content_provider_to_adapter_replays_both_endpoints(self):
        import os
        from unittest.mock import patch
        provider = self.content_provider()
        real_client = httpx.Client
        def adapter_transport(request):
            response = self.client.post(request.url.path, content=request.content, headers=request.headers)
            return httpx.Response(response.status_code, content=response.content, headers=response.headers)
        environment = {'ADMIN_AUTOMATION_ENABLED': 'true', 'ADMIN_TRANSLATION_URL': 'https://internal.test/translate', 'ADMIN_TTS_URL': 'https://internal.test/tts', 'ADMIN_PROVIDER_TOKEN': 'internal-test-token'}
        with patch.dict(os.environ, environment), patch.object(provider.httpx, 'Client', side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(adapter_transport), **kwargs)):
            job = {'NarrationId': 42, 'SourceVersion': 3, 'SourceLanguage': 'vi', 'LanguageCode': 'en', 'SourceText': 'Original narration', 'SourceName': 'Original name', 'SourceVoice': 'vi-VN'}
            first = provider.NarrationProvider().render(job)
            again = provider.NarrationProvider().render(job)
        self.assertEqual(first, again)
        self.assertEqual(first[2], b'ID3test-audio')
        self.assertEqual(first[3], 'audio/mpeg')
        self.assertEqual(len(self.calls), 2)

    def test_content_provider_preserves_retry_after_and_auth_retry_policy(self):
        import os
        from unittest.mock import patch
        provider = self.content_provider()
        real_client = httpx.Client
        environment = {'ADMIN_AUTOMATION_ENABLED': 'true', 'ADMIN_TTS_URL': 'https://internal.test/tts', 'ADMIN_PROVIDER_TOKEN_REQUIRED': 'false', 'ADMIN_PROVIDER_TOKEN': ''}
        job = {'NarrationId': 1, 'SourceVersion': 2, 'SourceLanguage': 'vi', 'LanguageCode': 'vi', 'SourceText': 'Original', 'SourceName': 'Name', 'SourceVoice': 'vi-VN'}
        response = httpx.Response(429, headers={'Retry-After': '120', 'X-Adapter-Error-Code': 'AzureRateLimited', 'X-Adapter-Retryable': 'true'})
        def handler(request):
            return response
        with patch.dict(os.environ, environment), patch.object(provider.httpx, 'Client', side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)):
            with self.assertRaises(provider.ProviderFailure) as err:
                provider.NarrationProvider().render(job)
            self.assertEqual(err.exception.retry_after, 120)
            self.assertTrue(err.exception.retryable)
            response = httpx.Response(502, headers={'X-Adapter-Error-Code': 'AzureAuthentication', 'X-Adapter-Retryable': 'false'})
            with self.assertRaises(provider.ProviderFailure) as err:
                provider.NarrationProvider().render(job)
            self.assertFalse(err.exception.retryable)
            self.assertEqual(err.exception.code, 'AzureAuthentication')

