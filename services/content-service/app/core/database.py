from contextlib import contextmanager
from collections.abc import Iterator

import pymssql
import pyodbc

from app.core.config import settings


class OdbcCursor:
    def __init__(self, cursor: pyodbc.Cursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> "OdbcCursor":
        return self

    def __exit__(self, *_: object) -> None:
        self._cursor.close()

    def execute(self, query: str, params: tuple = ()) -> "OdbcCursor":
        self._cursor.execute(query.replace("%s", "?"), params)
        return self

    def fetchone(self) -> dict | None:
        row = self._cursor.fetchone()
        return self._row_to_dict(row)

    def fetchall(self) -> list[dict]:
        return [self._row_to_dict(row) for row in self._cursor.fetchall()]

    def _row_to_dict(self, row: pyodbc.Row | None) -> dict | None:
        if row is None:
            return None
        columns = [column[0] for column in self._cursor.description]
        return dict(zip(columns, row, strict=True))


class OdbcConnection:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def __enter__(self) -> "OdbcConnection":
        return self

    def __exit__(self, *_: object) -> None:
        self._connection.close()

    def cursor(self) -> OdbcCursor:
        return OdbcCursor(self._connection.cursor())

    def commit(self) -> None:
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()


@contextmanager
def get_connection() -> Iterator[pymssql.Connection | OdbcConnection]:
    if settings.use_windows_auth:
        connection = OdbcConnection(
            pyodbc.connect(
                f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={settings.host};DATABASE={settings.database};Trusted_Connection=yes;TrustServerCertificate=yes;",
                timeout=10,
            )
        )
    else:
        connection = pymssql.connect(server=settings.host, port=str(settings.port), user=settings.user, password=settings.password, database=settings.database, as_dict=True)
    try:
        yield connection
    finally:
        connection.close()
