from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.database import get_connection


class AdminRepository:
    TABLES: dict[str, dict[str, Any]] = {
        "pois": {"table": "POIs", "id": "Id", "soft_delete": True, "fields": ["Code", "Name", "ShortDescription", "Description", "ApprovalStatus", "UserId", "Latitude", "Longitude", "RadiusMeters", "Priority", "IsActive", "LifecycleStatus", "PaymentRequired", "PaymentStatus", "ValidFrom", "ValidUntil", "ImageUrl", "ImageUrls", "Category", "CooldownSeconds", "MinDwellSeconds", "Version"]},
        "tours": {"table": "Tours", "id": "Id", "soft_delete": True, "fields": ["Code", "DefaultLanguage", "IsActive", "EstimatedMinutes", "Version"]},
        "audio": {"table": "AudioTracks", "id": "Id", "soft_delete": True, "fields": ["POIId", "LanguageCode", "Title", "AudioType", "FileUrl", "TTSText", "DurationSeconds", "FileSizeBytes", "MimeType", "IsActive", "Version"]},
        "qr": {"table": "QRLocations", "id": "Id", "soft_delete": True, "fields": ["Code", "Name", "PoiId", "TourId", "IsActive", "RequiresPayment", "PriceAmount", "AccessDurationMinutes"]},
        "languages": {"table": "Languages", "id": "Code", "soft_delete": False, "fields": ["Code", "Name", "NativeName", "IsActive", "SortOrder"]},
        "offline_packages": {"table": "OfflinePackages", "id": "Id", "soft_delete": False, "fields": ["TourId", "LanguageCode", "PackageVersion", "DownloadUrl", "FileSizeBytes", "Checksum", "IsActive", "PublishedAt"]},
        "media": {"table": "MediaFiles", "id": "Id", "soft_delete": "IsDeleted", "fields": ["FileName", "OriginalFileName", "FileType", "ContentType", "FileSize", "RelativePath", "UploadedAt", "UploadedByUserId", "PoiId", "ImageCategory", "ApprovalStatus", "SubmittedAt", "ReviewedByUserId", "ReviewedAt", "RejectionReason", "IsDeleted"]},
        "narrations": {"table": "NarrationDrafts", "id": "Id", "soft_delete": False, "fields": ["Title", "LanguageCode", "TextContent", "Voice", "PoiId", "Status", "SubmittedByUserId", "SubmittedAt", "ReviewedByUserId", "ReviewedAt", "RejectionReason", "GeneratedAudioTrackId", "AudioGeneratedAt", "SimulatedAudioUrl", "CreatedAt", "UpdatedAt"]},
        "narration_logs": {"table": "NarrationLogs", "id": "Id", "soft_delete": False, "fields": ["UserId", "POIId", "TriggerType", "LanguageCode", "PlayedAt", "DurationPlayedSeconds", "DeviceId", "Synced"]},
    }

    def fetchall(self, query: str, params: tuple = ()) -> list[dict]:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()

    def fetchone(self, query: str, params: tuple = ()) -> dict | None:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

    def execute(self, query: str, params: tuple = ()) -> None:
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute(query, params)
            connection.commit()

    def scalar(self, query: str, params: tuple = ()):
        row = self.fetchone(query, params)
        return next(iter(row.values())) if row else None

    def list_rows(self, resource: str, include_deleted: bool = False, filters: dict[str, Any] | None = None, page: int = 1, page_size: int = 100) -> dict:
        cfg = self._cfg(resource)
        table = cfg["table"]
        where, params = self._where(cfg, filters or {}, include_deleted)
        offset = max(page - 1, 0) * page_size
        total = self.scalar(f"SELECT COUNT(1) AS total FROM {table} {where}", tuple(params)) or 0
        rows = self.fetchall(f"SELECT * FROM {table} {where} ORDER BY {cfg['id']} DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY", tuple(params + [offset, page_size]))
        return {"items": rows, "page": page, "pageSize": page_size, "total": total}

    def get_row(self, resource: str, item_id: Any, include_deleted: bool = False) -> dict | None:
        cfg = self._cfg(resource)
        where, params = self._where(cfg, {cfg["id"]: item_id}, include_deleted)
        return self.fetchone(f"SELECT * FROM {cfg['table']} {where}", tuple(params))

    def create_row(self, resource: str, payload: dict) -> dict:
        cfg = self._cfg(resource)
        data = self._clean(cfg, payload, include_id=cfg["id"] != "Id")
        if "CreatedAt" in cfg["fields"] and "CreatedAt" not in data:
            data["CreatedAt"] = datetime.utcnow()
        if "UpdatedAt" in cfg["fields"] and "UpdatedAt" not in data:
            data["UpdatedAt"] = datetime.utcnow()
        columns = list(data.keys())
        placeholders = ", ".join(["%s"] * len(columns))
        column_sql = ", ".join(columns)
        values = tuple(data[column] for column in columns)
        if cfg["id"] == "Id":
            row = self.fetchone(f"INSERT INTO {cfg['table']} ({column_sql}) OUTPUT INSERTED.* VALUES ({placeholders})", values)
            return row or {}
        self.execute(f"INSERT INTO {cfg['table']} ({column_sql}) VALUES ({placeholders})", values)
        return self.get_row(resource, data[cfg["id"]], include_deleted=True) or data

    def update_row(self, resource: str, item_id: Any, payload: dict) -> dict:
        cfg = self._cfg(resource)
        data = self._clean(cfg, payload, include_id=False)
        if "UpdatedAt" in cfg["fields"]:
            data["UpdatedAt"] = datetime.utcnow()
        if not data:
            return self.get_row(resource, item_id, include_deleted=True) or {}
        set_sql = ", ".join(f"{column} = %s" for column in data)
        values = tuple(data.values()) + (item_id,)
        self.execute(f"UPDATE {cfg['table']} SET {set_sql} WHERE {cfg['id']} = %s", values)
        return self.get_row(resource, item_id, include_deleted=True) or {}

    def delete_row(self, resource: str, item_id: Any) -> None:
        cfg = self._cfg(resource)
        soft = cfg.get("soft_delete")
        if soft is True:
            self.execute(f"UPDATE {cfg['table']} SET DeletedAt = SYSUTCDATETIME() WHERE {cfg['id']} = %s", (item_id,))
        elif soft == "IsDeleted":
            self.execute(f"UPDATE {cfg['table']} SET IsDeleted = 1 WHERE {cfg['id']} = %s", (item_id,))
        else:
            self.execute(f"DELETE FROM {cfg['table']} WHERE {cfg['id']} = %s", (item_id,))

    def restore_row(self, resource: str, item_id: Any) -> None:
        cfg = self._cfg(resource)
        soft = cfg.get("soft_delete")
        if soft is True:
            self.execute(f"UPDATE {cfg['table']} SET DeletedAt = NULL WHERE {cfg['id']} = %s", (item_id,))
        elif soft == "IsDeleted":
            self.execute(f"UPDATE {cfg['table']} SET IsDeleted = 0 WHERE {cfg['id']} = %s", (item_id,))

    def by_column(self, resource: str, column: str, value: Any, include_deleted: bool = False) -> list[dict]:
        cfg = self._cfg(resource)
        if column not in cfg["fields"] and column != cfg["id"]:
            raise ValueError("Unsupported filter column")
        where, params = self._where(cfg, {column: value}, include_deleted)
        return self.fetchall(f"SELECT * FROM {cfg['table']} {where} ORDER BY {cfg['id']} DESC", tuple(params))

    def add_tour_translation(self, tour_id: int, payload: dict) -> dict:
        row = self.fetchone(
            "INSERT INTO TourTranslations (TourId, LanguageCode, Name, Description) OUTPUT INSERTED.* VALUES (%s, %s, %s, %s)",
            (tour_id, payload.get("languageCode") or payload.get("LanguageCode"), payload.get("name") or payload.get("Name"), payload.get("description") or payload.get("Description")),
        )
        return row or {}

    def update_tour_translation(self, translation_id: int, payload: dict) -> dict:
        self.execute("UPDATE TourTranslations SET LanguageCode = COALESCE(%s, LanguageCode), Name = COALESCE(%s, Name), Description = %s WHERE Id = %s", (payload.get("languageCode") or payload.get("LanguageCode"), payload.get("name") or payload.get("Name"), payload.get("description") or payload.get("Description"), translation_id))
        return self.fetchone("SELECT * FROM TourTranslations WHERE Id = %s", (translation_id,)) or {}

    def add_tour_poi(self, tour_id: int, payload: dict) -> dict:
        poi_id = payload.get("poiId") or payload.get("POIId") or payload.get("poi_id")
        order_index = payload.get("orderIndex") or payload.get("OrderIndex") or 0
        row = self.fetchone("INSERT INTO TourPOIs (TourId, POIId, OrderIndex) OUTPUT INSERTED.* VALUES (%s, %s, %s)", (tour_id, poi_id, order_index))
        return row or {}

    def reorder_tour_pois(self, tour_id: int, items: list[dict]) -> list[dict]:
        for index, item in enumerate(items):
            poi_id = item.get("poiId") or item.get("POIId") or item.get("id")
            order_index = item.get("orderIndex", index)
            self.execute("UPDATE TourPOIs SET OrderIndex = %s WHERE TourId = %s AND POIId = %s", (order_index, tour_id, poi_id))
        return self.fetchall("SELECT * FROM TourPOIs WHERE TourId = %s ORDER BY OrderIndex", (tour_id,))

    def analytics_summary(self) -> dict:
        return {
            "pois": self.scalar("SELECT COUNT(1) AS total FROM POIs WHERE DeletedAt IS NULL") or 0,
            "activePois": self.scalar("SELECT COUNT(1) AS total FROM POIs WHERE DeletedAt IS NULL AND IsActive = 1") or 0,
            "tours": self.scalar("SELECT COUNT(1) AS total FROM Tours WHERE DeletedAt IS NULL") or 0,
            "plays": self.scalar("SELECT COUNT(1) AS total FROM NarrationLogs") or 0,
            "devices": self.scalar("SELECT COUNT(1) AS total FROM Devices") or 0,
        }

    def save_media_file(self, file_name: str, original_name: str, content_type: str, file_size: int, relative_path: str, uploaded_by: int | None, poi_id: int | None, image_category: str | None, approval_status: str) -> dict:
        row = self.fetchone(
            """
            INSERT INTO MediaFiles (FileName, OriginalFileName, FileType, ContentType, FileSize, RelativePath, UploadedAt, UploadedByUserId, PoiId, ImageCategory, ApprovalStatus, SubmittedAt, IsDeleted)
            OUTPUT INSERTED.* VALUES (%s, %s, %s, %s, %s, %s, SYSUTCDATETIME(), %s, %s, %s, %s, SYSUTCDATETIME(), 0)
            """,
            (file_name, original_name, "image" if content_type.startswith("image/") else "audio", content_type, file_size, relative_path, uploaded_by, poi_id, image_category, approval_status),
        )
        return row or {}

    def _cfg(self, resource: str) -> dict[str, Any]:
        if resource not in self.TABLES:
            raise ValueError("Unsupported resource")
        return self.TABLES[resource]

    def _clean(self, cfg: dict, payload: dict, include_id: bool) -> dict:
        allowed = set(cfg["fields"])
        if include_id:
            allowed.add(cfg["id"])
        result = {}
        for key, value in payload.items():
            column = key[:1].upper() + key[1:]
            if key in allowed:
                result[key] = value
            elif column in allowed:
                result[column] = value
        return result

    def _where(self, cfg: dict, filters: dict[str, Any], include_deleted: bool) -> tuple[str, list]:
        clauses = []
        params: list = []
        for key, value in filters.items():
            if value is None or value == "":
                continue
            column = key if key in cfg["fields"] or key == cfg["id"] else key[:1].upper() + key[1:]
            if column not in cfg["fields"] and column != cfg["id"]:
                continue
            clauses.append(f"{column} = %s")
            params.append(value)
        soft = cfg.get("soft_delete")
        if not include_deleted:
            if soft is True:
                clauses.append("DeletedAt IS NULL")
            elif soft == "IsDeleted":
                clauses.append("IsDeleted = 0")
        return ("WHERE " + " AND ".join(clauses), params) if clauses else ("", params)
