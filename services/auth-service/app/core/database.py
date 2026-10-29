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

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


@contextmanager
def get_connection() -> Iterator[pymssql.Connection | OdbcConnection]:
    if settings.use_windows_auth or settings.sqlserver_odbc_driver:
        encrypt = "yes" if settings.sqlserver_encrypt else "no"
        trust_certificate = "yes" if settings.sqlserver_trust_server_certificate else "no"
        server = f"tcp:{settings.sqlserver_host},{settings.sqlserver_port}"
        driver = settings.sqlserver_odbc_driver or "ODBC Driver 17 for SQL Server"
        authentication = (
            "Trusted_Connection=yes;"
            if settings.use_windows_auth
            else f"UID={_odbc_value(settings.sqlserver_user)};PWD={_odbc_value(settings.sqlserver_password)};"
        )
        connection = OdbcConnection(
            pyodbc.connect(
                f"DRIVER={_odbc_value(driver)};SERVER={_odbc_value(server)};DATABASE={_odbc_value(settings.sqlserver_database)};"
                f"{authentication}Encrypt={encrypt};TrustServerCertificate={trust_certificate};",
                timeout=10,
            )
        )
    else:
        connection = pymssql.connect(server=settings.sqlserver_host, port=str(settings.sqlserver_port), user=settings.sqlserver_user, password=settings.sqlserver_password, database=settings.sqlserver_database, as_dict=True)
    with connection.cursor() as cursor:
        cursor.execute('SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;')
    try:
        yield connection
    finally:
        connection.close()


def _odbc_value(value: str) -> str:
    """Quote ODBC connection values, including passwords containing semicolons."""
    return "{" + value.replace("}", "}}") + "}"
