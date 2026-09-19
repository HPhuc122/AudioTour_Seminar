from app.core.database import get_connection


class UserRepository:
    def find_by_username(self, username: str) -> dict | None:
        query = """SELECT u.Id AS id, u.Username AS username, u.PasswordHash AS password_hash, r.Name AS role
                   FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId
                   WHERE u.Username = %s AND u.IsActive = 1"""
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, (username,))
            return cursor.fetchone()

    def upsert_device(self, device: dict) -> None:
        query = """MERGE Devices AS target USING (SELECT %s AS DeviceId) AS source
                   ON target.DeviceId = source.DeviceId
                   WHEN MATCHED THEN UPDATE SET Platform = %s, AppVersion = %s, OsVersion = %s, LastSeenAt = SYSUTCDATETIME()
                   WHEN NOT MATCHED THEN INSERT (DeviceId, Platform, AppVersion, OsVersion) VALUES (%s, %s, %s, %s);"""
        params = (device["device_id"], device["platform"], device.get("app_version"), device.get("os_version"), device["device_id"], device["platform"], device.get("app_version"), device.get("os_version"))
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            connection.commit()
