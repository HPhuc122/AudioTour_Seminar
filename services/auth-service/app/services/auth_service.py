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
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        token = jwt.encode({"sub": str(user["id"]), "username": user["username"], "role": user["role"], "exp": expires_at}, settings.jwt_secret, algorithm="HS256")
        return {"accessToken": token, "expiresAtUtc": expires_at.isoformat(), "userId": user["id"], "username": user["username"], "role": user["role"]}

    def register_device(self, device: dict) -> None:
        self._repository.upsert_device(device)
