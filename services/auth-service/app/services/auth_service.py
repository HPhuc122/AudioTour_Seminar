import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, status
from jose import jwt

from app.core.config import settings
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, repository: UserRepository | None = None) -> None:
        self._repository = repository or UserRepository()

    def login(self, username: str, password: str) -> dict:
        user = self._repository.find_by_username(username)
        if user is None or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        return self._issue_tokens(user)

    def refresh(self, refresh_token: str) -> dict:
        user = self._repository.find_by_refresh_token(refresh_token)
        if not user or not user.get("refresh_expires_at") or user["refresh_expires_at"] <= datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        return self._issue_tokens(user)

    def register_vendor(self, payload: dict) -> dict:
        roles = self._repository.list_roles()
        vendor_role = next((role for role in roles if role["name"] == "Vendor"), None)
        if not vendor_role:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vendor role is not configured")
        data = {"username": payload["username"], "email": payload["email"], "roleId": vendor_role["id"], "preferredLanguage": payload.get("preferred_language", "vi"), "isActive": True}
        return self._repository.create_user(data, self._hash_password(payload["password"]))

    def register_device(self, device: dict) -> None:
        self._repository.upsert_device(device)

    def list_users(self) -> list[dict]:
        return self._repository.list_users()

    def get_user(self, user_id: int) -> dict:
        user = self._repository.get_user(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def create_user(self, payload: dict) -> dict:
        if not payload.get("password"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password is required")
        return self._repository.create_user(payload, self._hash_password(payload["password"]))

    def update_user(self, user_id: int, payload: dict) -> dict:
        password_hash = self._hash_password(payload["password"]) if payload.get("password") else None
        return self._repository.update_user(user_id, payload, password_hash)

    def list_roles(self) -> list[dict]:
        return self._repository.list_roles()

    def get_role(self, role_id: int) -> dict:
        role = self._repository.get_role(role_id)
        if role is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        return role

    def create_role(self, payload: dict) -> dict:
        return self._repository.create_role(payload)

    def update_role(self, role_id: int, payload: dict) -> dict:
        return self._repository.update_role(role_id, payload)

    def delete_role(self, role_id: int) -> None:
        self._repository.delete_role(role_id)

    def get_device(self, device_id: str) -> dict:
        device = self._repository.get_device(device_id)
        if device is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        return device

    def devices_by_user(self, user_id: int) -> list[dict]:
        return self._repository.devices_by_user(user_id)

    def heartbeat_device(self, device_id: str) -> dict:
        device = self._repository.heartbeat_device(device_id)
        if device is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        return device

    def _issue_tokens(self, user: dict) -> dict:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        refresh_expires_at = datetime.utcnow() + timedelta(days=30)
        access_token = jwt.encode({"sub": str(user["id"]), "username": user["username"], "role": user["role"], "exp": expires_at}, settings.jwt_secret, algorithm="HS256")
        refresh_token = secrets.token_urlsafe(48)
        self._repository.update_refresh_token(user["id"], refresh_token, refresh_expires_at)
        return {"accessToken": access_token, "refreshToken": refresh_token, "expiresAtUtc": expires_at.isoformat(), "userId": user["id"], "username": user["username"], "role": user["role"]}

    @staticmethod
    def _hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
