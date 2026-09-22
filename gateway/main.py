"""Entry point for the AudioTour API gateway."""

import os

import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI(title="AudioTour Gateway")

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
CONTENT_SERVICE_URL = os.getenv("CONTENT_SERVICE_URL", "http://localhost:8002")
NARRATION_SERVICE_URL = os.getenv("NARRATION_SERVICE_URL", "http://localhost:8003")
AUTH_PREFIXES = ("/api/v1/auth", "/api/v1/users", "/api/v1/roles", "/api/v1/devices")
NARRATION_PREFIXES = ("/api/v1/narration-service",)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request) -> Response:
    target = _target_url(request.url.path)
    url = f"{target}/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"
    headers = {key: value for key, value in request.headers.items() if key.lower() != "host"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        upstream = await client.request(request.method, url, content=await request.body(), headers=headers)
    return Response(content=upstream.content, status_code=upstream.status_code, headers={key: value for key, value in upstream.headers.items() if key.lower() not in {"content-length", "transfer-encoding", "connection"}}, media_type=upstream.headers.get("content-type"))


def _target_url(path: str) -> str:
    if path.startswith(AUTH_PREFIXES):
        return AUTH_SERVICE_URL.rstrip("/")
    if path.startswith(NARRATION_PREFIXES):
        return NARRATION_SERVICE_URL.rstrip("/")
    return CONTENT_SERVICE_URL.rstrip("/")
