"""Existing HTTP adapter contracts, with bounded responses and no secret logging."""
import os
import math
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx


def configuration():
    translation = bool(os.getenv('ADMIN_TRANSLATION_URL'))
    tts = bool(os.getenv('ADMIN_TTS_URL'))
    enabled = os.getenv('ADMIN_AUTOMATION_ENABLED', 'false').lower() == 'true'
    missing = []
    for name, present in [('ADMIN_TRANSLATION_URL', translation), ('ADMIN_TTS_URL', tts)]:
        if not present:
            missing.append(name)
    if os.getenv('ADMIN_PROVIDER_TOKEN_REQUIRED', 'false').lower() == 'true' and not os.getenv('ADMIN_PROVIDER_TOKEN'):
        missing.append('ADMIN_PROVIDER_TOKEN')
    if not enabled:
        missing.append('ADMIN_AUTOMATION_ENABLED=true')
    return {'translationConfigured': translation, 'ttsConfigured': tts, 'automatic': enabled, 'missingConfiguration': missing}


def retry_after_seconds(value):
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        try:
            date = parsedate_to_datetime(value)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
            seconds = (date - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError, OverflowError):
            return None
    return max(1, math.ceil(seconds)) if math.isfinite(seconds) else None


class ProviderFailure(Exception):
    def __init__(self, code, message, retryable=True, retry_after=None):
        self.code, self.message, self.retryable = code, message, retryable
        self.retry_after = retry_after
        super().__init__(message)


class NarrationProvider:
    def render(self, job):
        config = configuration()
        missing = [name for name in config['missingConfiguration'] if name != 'ADMIN_TRANSLATION_URL' or job['LanguageCode'] != job['SourceLanguage']]
        if missing:
            raise ProviderFailure('MissingConfiguration', 'Missing: ' + ', '.join(missing), False)
        headers = {'Authorization': 'Bearer ' + os.environ['ADMIN_PROVIDER_TOKEN']} if os.getenv('ADMIN_PROVIDER_TOKEN') else {}
        # Stable keys allow an adapter to deduplicate an interrupted request.
        key = f"narration-{job['NarrationId']}-v{job['SourceVersion']}-{job['LanguageCode']}"
        headers['Idempotency-Key'] = key
        text, name = job['SourceText'], job['SourceName']
        try:
            with httpx.Client(timeout=httpx.Timeout(90, connect=10), follow_redirects=False) as client:
                if job['LanguageCode'] != job['SourceLanguage']:
                    response = client.post(os.environ['ADMIN_TRANSLATION_URL'], headers=headers, json={
                        'text': text, 'name': name, 'sourceLanguage': job['SourceLanguage'], 'targetLanguage': job['LanguageCode'],
                    })
                    response.raise_for_status()
                    result = response.json()
                    text, name = result.get('text'), result.get('name')
                    if not isinstance(text, str) or not text.strip() or not isinstance(name, str) or not name.strip() or len(name.encode('utf-16-le')) // 2 > 200:
                        raise ProviderFailure('InvalidTranslation', 'Translation adapter returned invalid text/name', False)
                with client.stream('POST', os.environ['ADMIN_TTS_URL'], headers=headers, json={
                    'text': text, 'languageCode': job['LanguageCode'],
                    'voice': job['SourceVoice'] if job['LanguageCode'] == job['SourceLanguage'] else None,
                }) as response:
                    response.raise_for_status()
                    mime = response.headers.get('content-type', '').split(';')[0].lower()
                    extensions = {'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg'}
                    if mime not in extensions:
                        raise ProviderFailure('InvalidAudio', 'TTS adapter must return MP3/WAV/OGG bytes', False)
                    chunks, size = [], 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > 50 * 1024 * 1024:
                            raise ProviderFailure('InvalidAudio', 'TTS audio exceeds 50 MB', False)
                        chunks.append(chunk)
                    audio = b''.join(chunks)
                    valid = (mime in {'audio/wav', 'audio/x-wav'} and audio[:4] == b'RIFF' and audio[8:12] == b'WAVE') or (mime == 'audio/ogg' and audio[:4] == b'OggS') or (mime == 'audio/mpeg' and (audio[:3] == b'ID3' or (len(audio) > 1 and audio[0] == 255 and audio[1] & 224 == 224)))
                    if not valid:
                        raise ProviderFailure('InvalidAudio', 'TTS response is empty or has an invalid audio header', False)
            return text.strip(), name.strip(), audio, mime, extensions[mime]
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            adapter_code = exc.response.headers.get('X-Adapter-Error-Code')
            safe_codes = {'AdapterConfiguration', 'AdapterAuthentication', 'AzureAuthentication', 'AzureRateLimited', 'AzureUnavailable', 'AzureConnectionFailed', 'ProviderResultUnknown', 'IdempotencyConflict', 'RequestInProgress', 'AzureRequestRejected', 'InvalidAzureResponse', 'IdempotencyStorageUnavailable'}
            failure_code = adapter_code if adapter_code in safe_codes else 'ProviderHTTPError'
            retryable = (code == 429 or code >= 500) and exc.response.headers.get('X-Adapter-Retryable') != 'false'
            raise ProviderFailure(failure_code, f'Adapter returned HTTP {code} ({failure_code}); check adapter configuration/status', retryable, retry_after_seconds(exc.response.headers.get('Retry-After'))) from None
        except (httpx.RequestError, ValueError, KeyError) as exc:
            raise ProviderFailure('ProviderUnavailable', 'Provider unavailable or returned invalid JSON') from None
