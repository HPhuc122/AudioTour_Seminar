import os
import unittest
from unittest.mock import patch

import httpx

from app.services.narration_provider import NarrationProvider, ProviderFailure


class ProviderContractTests(unittest.TestCase):
    def test_translation_output_is_the_target_tts_input(self):
        requests = []
        def handler(request):
            import json
            requests.append((str(request.url), json.loads(request.content)))
            if request.url.path == '/translate':
                return httpx.Response(200, json={'text': 'English translated text', 'name': 'English name'})
            return httpx.Response(200, content=b'RIFF0000WAVEtest', headers={'content-type': 'audio/wav'})
        client_type = httpx.Client
        with patch.dict(os.environ, {'ADMIN_AUTOMATION_ENABLED': 'true', 'ADMIN_TRANSLATION_URL': 'http://adapter.test/translate', 'ADMIN_TTS_URL': 'http://adapter.test/tts', 'ADMIN_PROVIDER_TOKEN_REQUIRED': 'false'}), patch('app.services.narration_provider.httpx.Client', side_effect=lambda **kwargs: client_type(transport=httpx.MockTransport(handler), **kwargs)):
            result = NarrationProvider().render({'NarrationId': 1, 'SourceVersion': 2, 'LanguageCode': 'en', 'SourceLanguage': 'vi', 'SourceText': 'Original text', 'SourceName': 'POI', 'SourceVoice': 'vi-VN'})
        self.assertEqual(result[0], 'English translated text')
        self.assertEqual(requests[1][1]['text'], 'English translated text')
        self.assertEqual(requests[1][1]['languageCode'], 'en')
        self.assertIsNone(requests[1][1]['voice'])

    def test_auth_failure_does_not_leak_response_or_retry(self):
        client_type = httpx.Client
        transport = httpx.MockTransport(lambda request: httpx.Response(401, text='secret-token-provider-detail'))
        with patch.dict(os.environ, {'ADMIN_AUTOMATION_ENABLED': 'true', 'ADMIN_TTS_URL': 'http://adapter.test/tts', 'ADMIN_PROVIDER_TOKEN_REQUIRED': 'false'}), patch('app.services.narration_provider.httpx.Client', side_effect=lambda **kwargs: client_type(transport=transport, **kwargs)), self.assertRaises(ProviderFailure) as err:
            NarrationProvider().render({'NarrationId': 1, 'SourceVersion': 2, 'LanguageCode': 'vi', 'SourceLanguage': 'vi', 'SourceText': 'Original', 'SourceName': 'POI', 'SourceVoice': None})
        self.assertFalse(err.exception.retryable)
        self.assertNotIn('secret-token', str(err.exception))
