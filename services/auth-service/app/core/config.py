import os
from pathlib import Path
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[4] / '.env')
    load_dotenv()
except Exception:
    pass


@dataclass(frozen=True)
class Settings:
    sqlserver_host: str = os.getenv("SQLSERVER_HOST", "localhost")
    sqlserver_port: int = int(os.getenv("SQLSERVER_PORT", "1433"))
    sqlserver_database: str = os.getenv("SQLSERVER_DATABASE", "VinhHyAudioTourDB")
    sqlserver_user: str = os.getenv("SQLSERVER_USER", "sa")
    sqlserver_password: str = os.getenv("SQLSERVER_PASSWORD", "")
    use_windows_auth: bool = os.getenv("SQLSERVER_USE_WINDOWS_AUTH", "false").lower() in {"1", "true", "yes"}
    jwt_secret: str = os.getenv("JWT_SECRET", "replace-this-development-secret")


settings = Settings()
