"""Demo-only online translation/TTS; subprocess deadlines bound library requests."""
import json
import subprocess
import sys
from pathlib import Path

from app.config import LANGUAGES
from app.errors import AdapterError


class Demo:
    def __init__(self, settings):
        self.settings = settings

    def run(self, operation, payload):
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'app.demo_worker', operation],
                input=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                capture_output=True, timeout=75,
                cwd=Path(__file__).resolve().parents[1],
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
        except subprocess.TimeoutExpired:
            raise AdapterError(504, 'DemoTimeout', 'Demo provider timed out; retry later', True, 30) from None
        except OSError:
            raise AdapterError(503, 'DemoUnavailable', 'Could not start demo provider', True, 30) from None
        if result.returncode:
            # Never expose upstream error bodies, source text, URLs or credentials.
            if result.returncode == 3:
                raise AdapterError(503, 'DemoDependencies', 'Install narration-service requirements before using demo provider')
            if result.returncode == 4:
                raise AdapterError(429, 'DemoRateLimited', 'Demo translation service rate limited the request', True, 60)
            if result.returncode == 5:
                raise AdapterError(503, 'DemoNoAudio', 'Speech service returned no audio; retry later', True, 30)
            if result.returncode == 6:
                raise AdapterError(429, 'DemoQuotaExceeded', 'MyMemory daily quota exhausted; retry after quota reset', True, 86400)
            if result.returncode == 7:
                raise AdapterError(502, 'InvalidDemoResponse', 'Demo translation returned an invalid response')
            raise AdapterError(503, 'DemoUnavailable', 'Demo translation or speech service is unavailable', True, 30)
        return result.stdout

    def translate(self, payload):
        if payload['sourceLanguage'] == payload['targetLanguage']:
            return json.dumps({'text': payload['text'], 'name': payload['name']}, ensure_ascii=False).encode(), 'application/json'
        raw = self.run('translate', {**payload, 'translator': self.settings.demo_translator})
        try:
            result = json.loads(raw)
            if any(not isinstance(result.get(k), str) or not result[k].strip() for k in ('text', 'name')):
                raise ValueError
            if len(result['name'].encode('utf-16-le')) // 2 > 200:
                raise ValueError
        except (ValueError, TypeError):
            raise AdapterError(502, 'InvalidDemoResponse', 'Demo translation returned invalid text or name') from None
        return raw, 'application/json'

    def tts(self, payload):
        code = payload['languageCode']
        voice = self.settings.voices[code]
        if payload.get('voice') not in {None, '', code, LANGUAGES[code][1], voice}:
            raise AdapterError(422, 'UnsupportedVoice', 'Request voice must match the configured voice or locale')
        raw = self.run('tts', {'text': payload['text'], 'voice': voice})
        valid = raw[:3] == b'ID3' or (len(raw) > 1 and raw[0] == 255 and raw[1] & 224 == 224)
        if not valid or len(raw) > 50 * 1024 * 1024:
            raise AdapterError(502, 'InvalidDemoResponse', 'Demo TTS returned invalid MP3 audio')
        return raw, 'audio/mpeg'
