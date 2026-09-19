from contextlib import contextmanager
from collections.abc import Iterator

import pymssql

from app.core.config import settings


@contextmanager
def get_connection() -> Iterator[pymssql.Connection]:
    connection = pymssql.connect(server=settings.host, port=str(settings.port), user=settings.user, password=settings.password, database=settings.database, as_dict=True)
    try:
        yield connection
    finally:
        connection.close()
