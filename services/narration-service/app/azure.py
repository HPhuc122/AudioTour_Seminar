"""Azure REST translation and speech. No hidden retries or credential logging."""
import json
import time
import xml.etree.ElementTree as ET

import httpx

from app.config import FORMATS, LANGUAGES
from app.errors import AdapterError, retry_after_seconds


class Azure:
    def __init__(self, settings, client):
        self.settings, self.client = settings, client

    def request(self, operation, **kwargs):
        try:
            endpoint = self.settings.endpoint(operation)
        except ValueError:
            raise AdapterError(503, 'AdapterConfiguration', 'Azure endpoint must be configured as an HTTPS URL') from None
        deadline = time.monotonic() + 70
        try:
            with self.client.stream('POST', endpoint, **kwargs) as response:
                if response.status_code in {401, 403}:
                    raise AdapterError(502, 'AzureAuthentication', 'Azure rejected authentication; check its key, region and endpoint')
                if response.status_code == 429:
                    raise AdapterError(429, 'AzureRateLimited', 'Azure rate limit exceeded', True, retry_after_seconds(response.headers.get('Retry-After')))
                if response.status_code >= 500:
                    raise AdapterError(503, 'AzureUnavailable', 'Azure returned a server error', True, retry_after_seconds(response.headers.get('Retry-After')))
                if not 200 <= response.status_code < 300:
                    raise AdapterError(502, 'AzureRequestRejected', 'Azure rejected this request; check language, voice and resource configuration')
                limit = 2 * 1024 * 1024 if operation == 'translate' else 50 * 1024 * 1024
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > limit or time.monotonic() > deadline:
                        raise AdapterError(409, 'ProviderResultUnknown', 'Azure response exceeded size/time budget; outcome requires reconciliation', uncertain=True)
                    chunks.append(chunk)
                return b''.join(chunks)
        except (httpx.ConnectTimeout, httpx.ConnectError, httpx.PoolTimeout):
            raise AdapterError(503, 'AzureConnectionFailed', 'Could not connect to Azure', True, 30) from None
        except httpx.RequestError:
            # Read/write/protocol loss may occur after Azure performed billable work.
            raise AdapterError(504, 'ProviderResultUnknown', 'Connection lost or timed out after request may have reached Azure; reconcile before retry', uncertain=True) from None

    def translate(self, payload):
        headers = {'Ocp-Apim-Subscription-Key': self.settings.translator_key, 'Content-Type': 'application/json'}
        if self.settings.translator_region:
            headers['Ocp-Apim-Subscription-Region'] = self.settings.translator_region
        raw = self.request('translate', headers=headers,
            params={'api-version': '3.0', 'from': LANGUAGES[payload['sourceLanguage']][0], 'to': LANGUAGES[payload['targetLanguage']][0]},
            json=[{'Text': payload['text']}, {'Text': payload['name']}])
        try:
            result = json.loads(raw)
            target = LANGUAGES[payload['targetLanguage']][0]
            if not isinstance(result, list) or len(result) != 2:
                raise ValueError
            texts = []
            for item in result:
                translations = item['translations']
                text = next(value['text'] for value in translations if value['to'].lower() == target.lower())
                if not isinstance(text, str) or not text.strip():
                    raise ValueError
                texts.append(text)
            if len(texts[1].encode('utf-16-le')) // 2 > 200:
                raise ValueError
        except (ValueError, TypeError, KeyError, StopIteration):
            raise AdapterError(502, 'InvalidAzureResponse', 'Azure returned an invalid translation response', uncertain=True) from None
        return json.dumps({'text': texts[0], 'name': texts[1]}, ensure_ascii=False).encode(), 'application/json'

    def tts(self, payload):
        code = payload['languageCode']
        locale = LANGUAGES[code][1]
        voice = self.settings.voices[code]
        # Legacy narration Voice is often a locale (vi-VN), not an Azure voice id.
        if payload.get('voice') not in {None, '', code, locale, voice}:
            raise AdapterError(422, 'UnsupportedVoice', 'Request voice must match the configured voice or locale')
        ET.register_namespace('', 'http://www.w3.org/2001/10/synthesis')
        speak = ET.Element('{http://www.w3.org/2001/10/synthesis}speak', {
            'version': '1.0', '{http://www.w3.org/XML/1998/namespace}lang': locale,
        })
        child = ET.SubElement(speak, '{http://www.w3.org/2001/10/synthesis}voice', {'name': voice})
        child.text = payload['text']  # XML escapes untrusted text, never accepts SSML input.
        ssml = ET.tostring(speak, encoding='utf-8')
        if len(ssml) > 60 * 1024:
            raise AdapterError(422, 'TextTooLong', 'Escaped speech request exceeds 60 KiB; split the narration')
        raw = self.request('tts', headers={
            'Ocp-Apim-Subscription-Key': self.settings.speech_key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': self.settings.speech_format,
            'User-Agent': 'AudioTour-NarrationAdapter',
        }, content=ssml)
        mime = FORMATS[self.settings.speech_format]
        valid = (mime == 'audio/wav' and raw[:4] == b'RIFF' and raw[8:12] == b'WAVE') or (mime == 'audio/ogg' and raw[:4] == b'OggS') or (mime == 'audio/mpeg' and (raw[:3] == b'ID3' or (len(raw) > 1 and raw[0] == 255 and raw[1] & 224 == 224)))
        if not valid:
            raise AdapterError(502, 'InvalidAzureResponse', 'Azure returned invalid audio bytes', uncertain=True)
        return raw, mime
