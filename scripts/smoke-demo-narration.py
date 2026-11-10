"""Opt-in real network smoke test; no SQL writes and no Google Cloud/Azure calls."""
import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

from dotenv import load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
sys.path.insert(0, str(ROOT / 'services/narration-service'))
from app.config import LANGUAGES, Settings
from app.main import create_app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--languages', nargs='+', choices=list(LANGUAGES), default=['vi', 'en'])
    args = parser.parse_args()
    output = ROOT / 'docs/reports/demo-narration-test'
    output.mkdir(parents=True, exist_ok=True)
    settings = Settings.from_env()
    if settings.provider != 'demo' or not settings.demo_enabled or not settings.adapter_token:
        raise SystemExit('Enable demo provider and configure its internal token first.')
    settings = replace(settings, cache_path=settings.cache_path.parent / 'smoke-demo.sqlite3')
    source = 'Chào mừng bạn đến phố ẩm thực Vĩnh Khánh.'
    results = []
    with TestClient(create_app(settings)) as client:
        for language in args.languages:
            headers = {'Authorization': 'Bearer ' + settings.adapter_token,
                       'Idempotency-Key': 'demo-smoke-v1-' + settings.demo_translator + '-' + language}
            translation_payload = {
                'text': source, 'name': 'Phố ẩm thực Vĩnh Khánh', 'sourceLanguage': 'vi', 'targetLanguage': language,
            }
            response = client.post('/translate', headers=headers, json=translation_payload)
            if response.status_code != 200:
                results.append({'language': language, 'translation_status': response.status_code, 'error': response.json()})
                if response.status_code == 429:
                    # Stop this batch rather than sending more requests while throttled.
                    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
                    break
                continue
            translated = response.json()
            translation_replay = client.post('/translate', headers=headers, json=translation_payload)
            payload = {'text': translated['text'], 'languageCode': language, 'voice': None}
            audio = client.post('/tts', headers=headers, json=payload)
            if audio.status_code != 200:
                results.append({'language': language, 'translation': translated, 'tts_status': audio.status_code, 'error': audio.json()})
                continue
            destination = output / (language + '.mp3')
            destination.write_bytes(audio.content)
            replay = client.post('/tts', headers=headers, json=payload)
            results.append({'language': language, 'translation': translated, 'tts_status': audio.status_code,
                            'audio_bytes': len(audio.content), 'file': str(destination),
                            'translation_cached_replay': translation_replay.headers.get('X-Idempotent-Replay') == 'true' and translation_replay.json() == translated,
                            'cached_replay': replay.headers.get('X-Idempotent-Replay') == 'true' and replay.content == audio.content})
            print(json.dumps(results[-1], ensure_ascii=False), flush=True)
    (output / 'result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    if not all(x.get('cached_replay') and x.get('translation_cached_replay') for x in results):
        print(json.dumps(results, ensure_ascii=False), flush=True)
        return 1
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
