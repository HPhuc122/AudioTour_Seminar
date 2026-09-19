import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    sqlserver_host: str = os.getenv("SQLSERVER_HOST", "localhost")
    sqlserver_port: int = int(os.getenv("SQLSERVER_PORT", "1433"))
    sqlserver_database: str = os.getenv("SQLSERVER_DATABASE", "AudioTourDB")
    sqlserver_user: str = os.getenv("SQLSERVER_USER", "sa")
    sqlserver_password: str = os.getenv("SQLSERVER_PASSWORD", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "replace-this-development-secret")


settings = Settings()
