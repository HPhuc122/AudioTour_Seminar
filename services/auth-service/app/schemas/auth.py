from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(alias="refreshToken")


class RegisterDeviceRequest(BaseModel):
    device_id: str = Field(min_length=1, alias="deviceId")
    platform: str
    app_version: str | None = Field(default=None, alias="appVersion")
    os_version: str | None = Field(default=None, alias="osVersion")
    push_token: str | None = Field(default=None, alias="pushToken")


class RegisterUserRequest(BaseModel):
    username: str
    email: str
    password: str
    preferred_language: str = Field(default="vi", alias="preferredLanguage")


class UserWriteRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None
    role_id: int | None = Field(default=None, alias="roleId")
    preferred_language: str | None = Field(default=None, alias="preferredLanguage")
    is_active: bool | None = Field(default=None, alias="isActive")


class RoleWriteRequest(BaseModel):
    name: str | None = None
    description: str | None = None
