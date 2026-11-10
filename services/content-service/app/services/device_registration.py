"""Forward mobile presence to Auth while retaining Content's existing LAN port."""
import httpx
from fastapi import HTTPException

from app.core.config import settings


async def register_device(payload: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
            response = await client.post(
                settings.auth_service_url.rstrip('/') + '/api/v1/auth/register-device',
                json=payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(503, 'Device registration temporarily unavailable') from exc
    if response.status_code == 422:
        raise HTTPException(422, 'Invalid device registration')
    if not response.is_success:
        raise HTTPException(502, 'Device registration failed')
