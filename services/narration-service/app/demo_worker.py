"""Private isolated worker. JSON on stdin; translation JSON or MP3 on stdout."""
import asyncio
import json
import sys


def split_text(text, limit=4500):
    """Keep sentence/word boundaries when possible, including CJK with no spaces."""
    chunks = []
    while len(text) > limit:
        end = max(text.rfind(mark, 0, limit + 1) for mark in ('\n', '. ', '! ', '? ', '。', '！', '？', ' '))
        end = end + 1 if end >= limit // 2 else limit
        chunks.append(text[:end])
        text = text[end:]
    if text:
        chunks.append(text)
    return chunks


async def speech(payload):
    import edge_tts
    from edge_tts.exceptions import NoAudioReceived
    for attempt in range(2):
        parts, size = [], 0
        communicate = edge_tts.Communicate(payload['text'], payload['voice'], connect_timeout=10, receive_timeout=30)
        try:
            async for item in communicate.stream():
                if item['type'] == 'audio':
                    size += len(item['data'])
                    if size > 50 * 1024 * 1024:
                        raise ValueError('Audio size limit exceeded')
                    parts.append(item['data'])
            if not parts:
                raise NoAudioReceived('No speech bytes received')
            return b''.join(parts)
        except NoAudioReceived:
            if attempt:
                raise
            await asyncio.sleep(1)


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read())
        if sys.argv[1] == 'translate':
            if payload.get('translator', 'mymemory') == 'mymemory':
                import httpx
                from app.demo_translation import translate_mymemory
                from app.errors import AdapterError
                try:
                    with httpx.Client(follow_redirects=False) as client:
                        result = translate_mymemory(payload, client)
                except AdapterError as error:
                    return {'DemoRateLimited': 4, 'DemoQuotaExceeded': 6,
                            'InvalidDemoResponse': 7}.get(error.code, 2)
                sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
                return 0
            from deep_translator import GoogleTranslator
            from deep_translator.exceptions import TooManyRequests
            languages = {'vi': 'vi', 'en': 'en', 'zh': 'zh-CN', 'ko': 'ko', 'ja': 'ja', 'fr': 'fr'}
            translator = GoogleTranslator(source=languages[payload['sourceLanguage']], target=languages[payload['targetLanguage']])
            try:
                result = {key: '\n'.join(translator.translate(chunk) for chunk in split_text(payload[key])) for key in ('text', 'name')}
            except TooManyRequests:
                return 4
            output = json.dumps(result, ensure_ascii=False).encode('utf-8')
        else:
            output = asyncio.run(asyncio.wait_for(speech(payload), timeout=70))
        sys.stdout.buffer.write(output)
        return 0
    except ImportError:
        return 3
    except Exception as error:
        if type(error).__name__ == 'NoAudioReceived':
            return 5
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
