from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterDeviceRequest, RegisterUserRequest, RoleWriteRequest, UserWriteRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
admin_router = APIRouter(tags=["auth-admin"])
service = AuthService()

ADMIN_ROLES = {"Admin", "SuperAdmin"}
OPS_ROLES = {"Admin", "SuperAdmin", "TourOperator", "ContentAdmin"}


def ok(data=None, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


def current_user(authorization: str | None = Header(default=None, alias="Authorization")) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is required")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1].strip(), settings.jwt_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    return {"id": int(payload.get("sub") or 0), "username": payload.get("username"), "role": payload.get("role")}


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role is required")
    return user


def require_ops(user: dict = Depends(current_user)) -> dict:
    if user.get("role") not in OPS_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operations role is required")
    return user


@router.post("/login")
def login(request: LoginRequest):
    return ok(service.login(request.username, request.password), "Login successful")


@router.post("/refresh")
def refresh(request: RefreshRequest):
    return ok(service.refresh(request.refresh_token), "Token refreshed")


@router.post("/register-device")
def register_device(request: RegisterDeviceRequest):
    service.register_device(request.model_dump())
    return ok(message="Device registered")


@router.post("/register")
def register(request: RegisterUserRequest):
    return ok(service.register_vendor(request.model_dump()), "User registered")


@admin_router.get("/api/v1/users")
def list_users(_: dict = Depends(require_admin)):
    return ok(service.list_users())


@admin_router.get("/api/v1/users/{id}")
def get_user(id: int, _: dict = Depends(require_admin)):
    return ok(service.get_user(id))


@admin_router.post("/api/v1/users")
def create_user(request: UserWriteRequest, _: dict = Depends(require_admin)):
    return ok(service.create_user(request.model_dump(exclude_none=True, by_alias=True)), "User created")


@admin_router.put("/api/v1/users/{id}")
def update_user(id: int, request: UserWriteRequest, _: dict = Depends(require_admin)):
    return ok(service.update_user(id, request.model_dump(exclude_none=True, by_alias=True)), "User updated")


@admin_router.get("/api/v1/roles")
def list_roles(_: dict = Depends(require_admin)):
    return ok(service.list_roles())


@admin_router.get("/api/v1/roles/{id}")
def get_role(id: int, _: dict = Depends(require_admin)):
    return ok(service.get_role(id))


@admin_router.post("/api/v1/roles")
def create_role(request: RoleWriteRequest, _: dict = Depends(require_admin)):
    return ok(service.create_role(request.model_dump(exclude_none=True, by_alias=True)), "Role created")


@admin_router.put("/api/v1/roles/{id}")
def update_role(id: int, request: RoleWriteRequest, _: dict = Depends(require_admin)):
    return ok(service.update_role(id, request.model_dump(exclude_none=True, by_alias=True)), "Role updated")


@admin_router.delete("/api/v1/roles/{id}")
def delete_role(id: int, _: dict = Depends(require_admin)):
    service.delete_role(id)
    return ok("Role deleted")


@admin_router.get("/api/v1/devices/{deviceId}")
def get_device(deviceId: str, _: dict = Depends(require_ops)):
    return ok(service.get_device(deviceId))


@admin_router.get("/api/v1/devices/by-user/{userId}")
def devices_by_user(userId: int, _: dict = Depends(require_ops)):
    return ok(service.devices_by_user(userId))


@admin_router.post("/api/v1/devices/{deviceId}/heartbeat")
def heartbeat_device(deviceId: str, _: dict = Depends(require_ops)):
    return ok(service.heartbeat_device(deviceId), "Device last seen updated")
