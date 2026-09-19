from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterDeviceRequest(BaseModel):
    device_id: str = Field(min_length=1, serialization_alias="deviceId")
    platform: str
    app_version: str | None = Field(default=None, serialization_alias="appVersion")
    os_version: str | None = Field(default=None, serialization_alias="osVersion")
