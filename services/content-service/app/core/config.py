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
class SqlServerSettings:
    host: str = os.getenv("SQLSERVER_HOST", "localhost")
    port: int = int(os.getenv("SQLSERVER_PORT", "1433"))
    database: str = os.getenv("SQLSERVER_DATABASE", "AudioTourVinhKhanh")
    user: str = os.getenv("SQLSERVER_USER", "sa")
    password: str = os.getenv("SQLSERVER_PASSWORD", "")
    use_windows_auth: bool = os.getenv("SQLSERVER_USE_WINDOWS_AUTH", "false").lower() in {"1", "true", "yes"}
    odbc_driver: str = os.getenv("SQLSERVER_ODBC_DRIVER", "")
    encrypt: bool = os.getenv("SQLSERVER_ENCRYPT", "true").lower() in {"1", "true", "yes"}
    trust_server_certificate: bool = os.getenv("SQLSERVER_TRUST_SERVER_CERTIFICATE", "true").lower() in {"1", "true", "yes"}
    media_root: str = os.getenv("MEDIA_ROOT", str(Path(__file__).resolve().parents[2]))
    public_web_base_url: str = os.getenv("PUBLIC_WEB_BASE_URL", "http://localhost:5173")
    public_api_base_url: str = os.getenv("PUBLIC_API_BASE_URL", "")
    open_route_service_api_key: str = os.getenv("ORS_API_KEY", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "replace-this-development-secret")


settings = SqlServerSettings()
