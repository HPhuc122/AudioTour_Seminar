import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SqlServerSettings:
    host: str = os.getenv("SQLSERVER_HOST", "localhost")
    port: int = int(os.getenv("SQLSERVER_PORT", "1433"))
    database: str = os.getenv("SQLSERVER_DATABASE", "AudioTourDB")
    user: str = os.getenv("SQLSERVER_USER", "sa")
    password: str = os.getenv("SQLSERVER_PASSWORD", "")


settings = SqlServerSettings()
