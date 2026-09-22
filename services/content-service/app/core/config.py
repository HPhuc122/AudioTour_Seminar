import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


@dataclass(frozen=True)
class SqlServerSettings:
    host: str = os.getenv("SQLSERVER_HOST", "localhost")
    port: int = int(os.getenv("SQLSERVER_PORT", "1433"))
    database: str = os.getenv("SQLSERVER_DATABASE", "AudioTourDB")
    user: str = os.getenv("SQLSERVER_USER", "sa")
    password: str = os.getenv("SQLSERVER_PASSWORD", "")
    media_root: str = os.getenv("MEDIA_ROOT", os.getcwd())
    public_web_base_url: str = os.getenv("PUBLIC_WEB_BASE_URL", "http://localhost:5173")
    open_route_service_api_key: str = os.getenv("ORS_API_KEY", "")


settings = SqlServerSettings()
