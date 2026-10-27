import hmac
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.azure import Azure
from app.config import Settings
from app.errors import AdapterError
from app.store import Store

Language = Literal['vi', 'en', 'zh', 'ko', 'ja', 'fr']


class TextRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=10000)

    @field_validator('text')
    @classmethod
    def nonblank(cls, value):
        if not value.strip() or any(ord(char) < 32 and char not in '\n\r\t' for char in value):
            raise ValueError('Nonempty plain text required')
        return value


class TranslationRequest(TextRequest):
    name: str = Field(min_length=1, max_length=200)
    sourceLanguage: Language
    targetLanguage: Language

    @field_validator('name')
    @classmethod
    def valid_name(cls, value):
        if not value.strip() or len(value.encode('utf-16-le')) // 2 > 200:
            raise ValueError('Nonempty name, maximum 200 UTF-16 units')
        return value


class SpeechRequest(TextRequest):
    languageCode: Language
    voice: str | None = Field(default=None, max_length=200)


def create_app(settings=None, client=None, store=None):
    settings = settings or Settings.from_env()
    owned_client = client is None
    client = client or httpx.Client(timeout=httpx.Timeout(60, connect=10), follow_redirects=False)
    store = store or Store(settings.cache_path)
    azure = Azure(settings, client)

    @asynccontextmanager
    async def lifespan(app):
        yield
        if owned_client:
            client.close()

    app = FastAPI(title='AudioTour Narration Service', lifespan=lifespan)

    @app.exception_handler(AdapterError)
    async def adapter_error(request: Request, error: AdapterError):
        headers = {'X-Adapter-Error-Code': error.code, 'X-Adapter-Retryable': str(error.retryable).lower()}
        if error.retry_after:
            headers['Retry-After'] = str(error.retry_after)
        return JSONResponse(status_code=error.status, content={'error': {'code': error.code, 'message': error.message}}, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        return JSONResponse(status_code=422, content={'error': {'code': 'InvalidRequest', 'message': 'Invalid text, language, name or voice'}})

    def authorize(authorization: str | None = Header(None)):
        if not settings.adapter_token:
            raise AdapterError(503, 'AdapterConfiguration', 'Missing NARRATION_ADAPTER_TOKEN')
        if not authorization or not authorization.startswith('Bearer ') or not hmac.compare_digest(authorization[7:].encode(), settings.adapter_token.encode()):
            raise AdapterError(401, 'AdapterAuthentication', 'Invalid adapter token')

    def execute(operation, payload, key):
        if not key or not key.strip() or len(key) > 200 or any(ord(c) < 33 or ord(c) > 126 for c in key):
            raise AdapterError(422, 'InvalidIdempotencyKey', 'A printable Idempotency-Key of 1-200 characters is required')
        try:
            owner, cached = store.begin(operation, key, payload)
        except AdapterError:
            raise
        except Exception:
            raise AdapterError(503, 'IdempotencyStorageUnavailable', 'Persistent idempotency storage is unavailable', True, 30) from None
        if cached:
            body, mime = cached
            return Response(content=body, media_type=mime, headers={'X-Idempotent-Replay': 'true'})
        try:
            missing = settings.missing(operation)
            if missing:
                raise AdapterError(503, 'AdapterConfiguration', 'Missing: ' + ', '.join(missing))
            body, mime = azure.translate(payload) if operation == 'translate' else azure.tts(payload)
            store.complete(operation, key, owner, body, mime)
        except AdapterError as error:
            try:
                store.fail(operation, key, owner, error)
            except Exception:
                raise AdapterError(409, 'ProviderResultUnknown', 'Failed to persist request state; reconcile before retry', uncertain=True) from None
            raise
        except Exception:
            # Includes a lost persistence acknowledgement after a successful call.
            error = AdapterError(409, 'ProviderResultUnknown', 'Request outcome could not be persisted; reconcile before retry', uncertain=True)
            try:
                store.fail(operation, key, owner, error)
            except Exception:
                pass
            raise error from None
        return Response(content=body, media_type=mime)

    @app.get('/health')
    async def health():
        return {'status': 'ok', 'azureEnabled': settings.enabled}

    @app.post('/translate', dependencies=[Depends(authorize)])
    def translate(payload: TranslationRequest, idempotency_key: str | None = Header(None)):
        return execute('translate', payload.model_dump(), idempotency_key)

    @app.post('/tts', dependencies=[Depends(authorize)])
    def tts(payload: SpeechRequest, idempotency_key: str | None = Header(None)):
        return execute('tts', payload.model_dump(), idempotency_key)

    return app


app = create_app()
