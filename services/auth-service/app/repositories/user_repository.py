from app.core.database import get_connection


class UserRepository:
    def _fetchall(self, query: str, params: tuple = ()) -> list[dict]:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()

    def _fetchone(self, query: str, params: tuple = ()) -> dict | None:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

    def _execute(self, query: str, params: tuple = ()) -> None:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            connection.commit()

    def find_by_username(self, username: str) -> dict | None:
        query = """SELECT u.Id AS id, u.Username AS username, u.Email AS email, u.PasswordHash AS password_hash, r.Name AS role
                   FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId
                   WHERE u.Username = %s AND u.IsActive = 1"""
        return self._fetchone(query, (username,))

    def find_by_id(self, user_id: int) -> dict | None:
        query = """SELECT u.Id AS id, u.Username AS username, u.Email AS email, u.PasswordHash AS password_hash, r.Name AS role
                   FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId
                   WHERE u.Id = %s AND u.IsActive = 1"""
        return self._fetchone(query, (user_id,))

    def update_refresh_token(self, user_id: int, refresh_token: str | None, expires_at) -> None:
        self._execute("UPDATE Users SET RefreshToken = %s, RefreshTokenExpiry = %s, UpdatedAt = SYSUTCDATETIME() WHERE Id = %s", (refresh_token, expires_at, user_id))

    def find_by_refresh_token(self, refresh_token: str) -> dict | None:
        query = """SELECT u.Id AS id, u.Username AS username, u.Email AS email, u.RefreshTokenExpiry AS refresh_expires_at, r.Name AS role
                   FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId
                   WHERE u.RefreshToken = %s AND u.IsActive = 1"""
        return self._fetchone(query, (refresh_token,))

    def upsert_device(self, device: dict) -> None:
        query = """MERGE Devices AS target USING (SELECT %s AS DeviceId) AS source
                   ON target.DeviceId = source.DeviceId
                   WHEN MATCHED THEN UPDATE SET Platform = %s, AppVersion = %s, OsVersion = %s, PushToken = COALESCE(%s, PushToken), LastSeenAt = SYSUTCDATETIME()
                   WHEN NOT MATCHED THEN INSERT (DeviceId, Platform, AppVersion, OsVersion, PushToken) VALUES (%s, %s, %s, %s, %s);"""
        params = (device["device_id"], device["platform"], device.get("app_version"), device.get("os_version"), device.get("push_token"), device["device_id"], device["platform"], device.get("app_version"), device.get("os_version"), device.get("push_token"))
        self._execute(query, params)

    def list_users(self) -> list[dict]:
        return self._fetchall("""SELECT u.Id AS id, u.Username AS username, u.Email AS email, u.PreferredLanguage AS preferredLanguage, u.IsActive AS isActive, u.CreatedAt AS createdAt, u.UpdatedAt AS updatedAt, r.Id AS roleId, r.Name AS role FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId ORDER BY u.Id DESC""")

    def get_user(self, user_id: int) -> dict | None:
        rows = self._fetchall("""SELECT u.Id AS id, u.Username AS username, u.Email AS email, u.PreferredLanguage AS preferredLanguage, u.IsActive AS isActive, u.CreatedAt AS createdAt, u.UpdatedAt AS updatedAt, r.Id AS roleId, r.Name AS role FROM Users u INNER JOIN Roles r ON r.Id = u.RoleId WHERE u.Id = %s""", (user_id,))
        return rows[0] if rows else None

    def create_user(self, payload: dict, password_hash: str) -> dict:
        row = self._fetchone(
            """INSERT INTO Users (Username, Email, PasswordHash, RoleId, PreferredLanguage, IsActive, CreatedAt, UpdatedAt)
               OUTPUT INSERTED.Id AS id, INSERTED.Username AS username, INSERTED.Email AS email, INSERTED.RoleId AS roleId, INSERTED.PreferredLanguage AS preferredLanguage, INSERTED.IsActive AS isActive
               VALUES (%s, %s, %s, %s, %s, %s, SYSUTCDATETIME(), SYSUTCDATETIME())""",
            (payload.get("username"), payload.get("email"), password_hash, payload.get("roleId"), payload.get("preferredLanguage", "vi"), payload.get("isActive", True)),
        )
        return row or {}

    def update_user(self, user_id: int, payload: dict, password_hash: str | None = None) -> dict:
        fields = []
        values = []
        mapping = {"username": "Username", "email": "Email", "roleId": "RoleId", "preferredLanguage": "PreferredLanguage", "isActive": "IsActive"}
        for key, column in mapping.items():
            if key in payload and payload[key] is not None:
                fields.append(f"{column} = %s")
                values.append(payload[key])
        if password_hash:
            fields.append("PasswordHash = %s")
            values.append(password_hash)
        fields.append("UpdatedAt = SYSUTCDATETIME()")
        values.append(user_id)
        self._execute(f"UPDATE Users SET {', '.join(fields)} WHERE Id = %s", tuple(values))
        return self.get_user(user_id) or {}

    def list_roles(self) -> list[dict]:
        return self._fetchall("SELECT Id AS id, Name AS name, Description AS description FROM Roles ORDER BY Id")

    def get_role(self, role_id: int) -> dict | None:
        return self._fetchone("SELECT Id AS id, Name AS name, Description AS description FROM Roles WHERE Id = %s", (role_id,))

    def create_role(self, payload: dict) -> dict:
        return self._fetchone("INSERT INTO Roles (Name, Description) OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Description AS description VALUES (%s, %s)", (payload.get("name"), payload.get("description"))) or {}

    def update_role(self, role_id: int, payload: dict) -> dict:
        self._execute("UPDATE Roles SET Name = COALESCE(%s, Name), Description = %s WHERE Id = %s", (payload.get("name"), payload.get("description"), role_id))
        return self.get_role(role_id) or {}

    def delete_role(self, role_id: int) -> None:
        self._execute("DELETE FROM Roles WHERE Id = %s", (role_id,))

    def get_device(self, device_id: str) -> dict | None:
        return self._fetchone("SELECT * FROM Devices WHERE DeviceId = %s", (device_id,))

    def devices_by_user(self, user_id: int) -> list[dict]:
        return self._fetchall("SELECT * FROM Devices WHERE UserId = %s ORDER BY LastSeenAt DESC", (user_id,))

    def heartbeat_device(self, device_id: str) -> dict | None:
        self._execute("UPDATE Devices SET LastSeenAt = SYSUTCDATETIME() WHERE DeviceId = %s", (device_id,))
        return self.get_device(device_id)
