from contextlib import contextmanager
from collections.abc import Iterator

import pymssql

from app.core.config import settings


@contextmanager
def get_connection() -> Iterator[pymssql.Connection]:
    connection = pymssql.connect(server=settings.sqlserver_host, port=str(settings.sqlserver_port), user=settings.sqlserver_user, password=settings.sqlserver_password, database=settings.sqlserver_database, as_dict=True)
    try:
        yield connection
    finally:
        connection.close()
