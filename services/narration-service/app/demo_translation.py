"""Explicit demo translation engines; never silently bypass a provider quota."""
import html

import httpx

from app.errors import AdapterError, retry_after_seconds

MYMEMORY_LANGUAGES = {'vi': 'vi-VN', 'en': 'en-GB', 'zh': 'zh-CN',
                      'ko': 'ko-KR', 'ja': 'ja-JP', 'fr': 'fr-FR'}


def split_utf8(text, limit=500):
    """MyMemory limits q to 500 UTF-8 bytes, not 500 Unicode characters."""
    chunks = []
    while text:
        end, size = 0, 0
        for char in text:
            width = len(char.encode('utf-8'))
            if size + width > limit:
                break
            size += width
            end += 1
        if not end:
            raise ValueError('UTF-8 byte limit too small')
        if end < len(text):
            boundary = max(text.rfind(mark, 0, end) for mark in ('\n', ' ', '。', '！', '？'))
            if boundary >= end // 2:
                end = boundary + 1
        chunks.append(text[:end])
        text = text[end:]
    return chunks


def translate_mymemory(payload, client):
    pair = MYMEMORY_LANGUAGES[payload['sourceLanguage']] + '|' + MYMEMORY_LANGUAGES[payload['targetLanguage']]
    result = {}
    for key in ('text', 'name'):
        translated = []
        for chunk in split_utf8(payload[key]):
            if not chunk.strip():
                translated.append(chunk)
                continue
            try:
                response = client.get('https://api.mymemory.translated.net/get', params={'q': chunk, 'langpair': pair}, timeout=15)
                if response.status_code == 429:
                    raise AdapterError(429, 'DemoRateLimited', 'MyMemory rate limit exceeded; retry later', True,
                                       retry_after_seconds(response.headers.get('Retry-After'), 60))
                if not response.is_success:
                    raise AdapterError(503, 'DemoUnavailable', 'MyMemory translation service is unavailable', True, 30)
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError
                if data.get('quotaFinished') or str(data.get('responseStatus')) == '429':
                    # Anonymous quota is shared by the service's caller IP, not each job.
                    raise AdapterError(429, 'DemoQuotaExceeded', 'MyMemory daily quota exhausted; retry after quota reset', True, 86400)
                if str(data.get('responseStatus')) != '200':
                    raise AdapterError(502, 'InvalidDemoResponse', 'MyMemory rejected this translation segment')
                text = data['responseData']['translatedText']
                if not isinstance(text, str) or not text.strip():
                    raise ValueError
                translated.append(html.unescape(text))
            except AdapterError:
                raise
            except httpx.RequestError:
                raise AdapterError(503, 'DemoUnavailable', 'Could not connect to MyMemory', True, 30) from None
            except (ValueError, TypeError, KeyError):
                raise AdapterError(502, 'InvalidDemoResponse', 'MyMemory returned an invalid translation response') from None
        result[key] = '\n'.join(translated)
    return result
