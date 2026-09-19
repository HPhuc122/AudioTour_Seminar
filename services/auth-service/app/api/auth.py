from fastapi import APIRouter

from app.schemas.auth import LoginRequest, RegisterDeviceRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
service = AuthService()


def ok(data=None, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


@router.post("/login")
def login(request: LoginRequest):
    return ok(service.login(request.username, request.password), "Login successful")


@router.post("/register-device")
def register_device(request: RegisterDeviceRequest):
    service.register_device(request.model_dump())
    return ok(message="Device registered")
