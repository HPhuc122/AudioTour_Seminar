import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

LANGUAGES = {
    'vi': ('vi', 'vi-VN', 'vi-VN-HoaiMyNeural'),
    'en': ('en', 'en-US', 'en-US-AriaNeural'),
    'zh': ('zh-Hans', 'zh-CN', 'zh-CN-XiaoxiaoNeural'),
    'ko': ('ko', 'ko-KR', 'ko-KR-SunHiNeural'),
    'ja': ('ja', 'ja-JP', 'ja-JP-NanamiNeural'),
    'fr': ('fr', 'fr-FR', 'fr-FR-DeniseNeural'),
}
FORMATS = {
    'audio-24khz-48kbitrate-mono-mp3': 'audio/mpeg',
    'riff-24khz-16bit-mono-pcm': 'audio/wav',
    'ogg-24khz-16bit-mono-opus': 'audio/ogg',
}


@dataclass(frozen=True)
class Settings:
    enabled: bool = False
    adapter_token: str = field(default='', repr=False)
    translator_key: str = field(default='', repr=False)
    translator_region: str = ''
    translator_endpoint: str = 'https://api.cognitive.microsofttranslator.com/translate'
    speech_key: str = field(default='', repr=False)
    speech_region: str = ''
    speech_endpoint: str = ''
    speech_format: str = 'audio-24khz-48kbitrate-mono-mp3'
    voices: dict = field(default_factory=lambda: {code: value[2] for code, value in LANGUAGES.items()})
    cache_path: Path = field(default_factory=lambda: Path(__file__).resolve().parents[1] / 'data/adapter.sqlite3')

    @classmethod
    def from_env(cls):
        voices = {code: value[2] for code, value in LANGUAGES.items()}
        raw = os.getenv('AZURE_SPEECH_VOICES_JSON', '')
        try:
            overrides = json.loads(raw) if raw else {}
            if not isinstance(overrides, dict) or set(overrides) - set(LANGUAGES):
                raise ValueError
            voices.update(overrides)
        except (ValueError, TypeError):
            raise RuntimeError('AZURE_SPEECH_VOICES_JSON must be a JSON object keyed by supported language codes') from None
        for code, voice in voices.items():
            if not isinstance(voice, str) or not re.fullmatch(r'[A-Za-z0-9:._-]{1,200}', voice) or not voice.startswith(LANGUAGES[code][1] + '-'):
                raise RuntimeError('AZURE_SPEECH_VOICES_JSON contains a voice incompatible with its locale')
        values = dict(
            enabled=os.getenv('NARRATION_AZURE_ENABLED', 'false').lower() == 'true',
            adapter_token=os.getenv('NARRATION_ADAPTER_TOKEN', ''),
            translator_key=os.getenv('AZURE_TRANSLATOR_KEY', ''),
            translator_region=os.getenv('AZURE_TRANSLATOR_REGION', ''),
            translator_endpoint=os.getenv('AZURE_TRANSLATOR_ENDPOINT', cls.translator_endpoint),
            speech_key=os.getenv('AZURE_SPEECH_KEY', ''),
            speech_region=os.getenv('AZURE_SPEECH_REGION', ''),
            speech_endpoint=os.getenv('AZURE_SPEECH_ENDPOINT', ''),
            speech_format=os.getenv('AZURE_SPEECH_OUTPUT_FORMAT', cls.speech_format),
            voices=voices,
        )
        if os.getenv('NARRATION_ADAPTER_CACHE_PATH'):
            values['cache_path'] = Path(os.environ['NARRATION_ADAPTER_CACHE_PATH'])
        result = cls(**values)
        if result.adapter_token and result.adapter_token in {result.translator_key, result.speech_key}:
            raise RuntimeError('NARRATION_ADAPTER_TOKEN must differ from both Azure resource keys')
        if result.speech_format not in FORMATS:
            raise RuntimeError('Unsupported AZURE_SPEECH_OUTPUT_FORMAT')
        return result

    def missing(self, operation):
        missing = []
        if not self.enabled:
            missing.append('NARRATION_AZURE_ENABLED=true')
        if operation == 'translate':
            if not self.translator_key:
                missing.append('AZURE_TRANSLATOR_KEY')
            if not self.translator_endpoint:
                missing.append('AZURE_TRANSLATOR_ENDPOINT')
        else:
            if not self.speech_key:
                missing.append('AZURE_SPEECH_KEY')
            if not self.speech_endpoint and not self.speech_region:
                missing.append('AZURE_SPEECH_REGION or AZURE_SPEECH_ENDPOINT')
        return missing

    def endpoint(self, operation):
        endpoint = self.translator_endpoint if operation == 'translate' else self.speech_endpoint or f'https://{self.speech_region}.tts.speech.microsoft.com/cognitiveservices/v1'
        parsed = urlsplit(endpoint)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Azure endpoint must be an HTTPS URL without credentials, query or fragment')
        return endpoint
