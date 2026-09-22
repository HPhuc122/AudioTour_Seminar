from datetime import datetime, timezone

from app.core.database import get_connection


class ContentRepository:
    """SQL Server queries only; no HTTP or business-policy code."""

    PUBLIC_POI_WHERE = """
        p.IsActive = 1
        AND p.DeletedAt IS NULL
        AND p.LifecycleStatus = 3
        AND (p.ValidFrom IS NULL OR p.ValidFrom <= SYSUTCDATETIME())
        AND (p.ValidUntil IS NULL OR p.ValidUntil >= SYSUTCDATETIME())
    """

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

    def _scalar(self, query: str, params: tuple = ()):  # noqa: ANN001
        row = self._fetchone(query, params)
        return next(iter(row.values())) if row else None

    def list_public_tours(self, language: str) -> list[dict]:
        query = """
        SELECT t.Id AS id, t.Code AS code,
               COALESCE(tt.Name, ttvi.Name, t.Code) AS name,
               COALESCE(tt.Description, ttvi.Description) AS description,
               t.EstimatedMinutes AS estimatedMinutes
        FROM Tours t
        LEFT JOIN TourTranslations tt ON tt.TourId = t.Id AND tt.LanguageCode = %s
        LEFT JOIN TourTranslations ttvi ON ttvi.TourId = t.Id AND ttvi.LanguageCode = 'vi'
        WHERE t.IsActive = 1 AND t.DeletedAt IS NULL
        ORDER BY COALESCE(tt.Name, ttvi.Name, t.Code)
        """
        return self._fetchall(query, (language,))

    def get_public_tour(self, tour_id: int, language: str) -> dict | None:
        query = """
        SELECT t.Id AS id, t.Code AS code, t.DefaultLanguage AS defaultLanguage,
               COALESCE(tt.Name, ttvi.Name, t.Code) AS name,
               COALESCE(tt.Description, ttvi.Description) AS description,
               t.EstimatedMinutes AS estimatedMinutes
        FROM Tours t
        LEFT JOIN TourTranslations tt ON tt.TourId = t.Id AND tt.LanguageCode = %s
        LEFT JOIN TourTranslations ttvi ON ttvi.TourId = t.Id AND ttvi.LanguageCode = 'vi'
        WHERE t.Id = %s AND t.IsActive = 1 AND t.DeletedAt IS NULL
        """
        tour = self._fetchone(query, (language, tour_id))
        if tour:
            tour["pois"] = self.list_tour_pois(tour_id, language)
        return tour

    def list_tour_pois(self, tour_id: int, language: str) -> list[dict]:
        query = f"""
        SELECT p.Id AS id, p.Code AS code,
               COALESCE(pt.Name, ptvi.Name, p.Name, p.Code) AS name,
               COALESCE(pt.ShortDescription, ptvi.ShortDescription, p.ShortDescription) AS shortDescription,
               COALESCE(pt.Description, ptvi.Description, p.Description) AS narrationText,
               p.Latitude AS latitude, p.Longitude AS longitude, p.ImageUrl AS imageUrl,
               p.Category AS category, tp.OrderIndex AS orderIndex
        FROM TourPOIs tp
        INNER JOIN POIs p ON p.Id = tp.POIId
        LEFT JOIN POITranslations pt ON pt.POIId = p.Id AND pt.LanguageCode = %s
        LEFT JOIN POITranslations ptvi ON ptvi.POIId = p.Id AND ptvi.LanguageCode = 'vi'
        WHERE tp.TourId = %s AND {self.PUBLIC_POI_WHERE}
        ORDER BY tp.OrderIndex, COALESCE(pt.Name, ptvi.Name, p.Name, p.Code)
        """
        pois = self._fetchall(query, (language, tour_id))
        for poi in pois:
            poi["audioTracks"] = self.list_audio_tracks_for_poi(poi["id"], language)
        return pois

    def list_public_pois(self, language: str, page: int = 1, page_size: int = 20, search: str | None = None, category: str | None = None) -> dict:
        where = [self.PUBLIC_POI_WHERE]
        params: list = [language]
        if search:
            where.append("(p.Code LIKE %s OR p.Name LIKE %s OR pt.Name LIKE %s OR ptvi.Name LIKE %s)")
            term = f"%{search}%"
            params.extend([term, term, term, term])
        if category:
            where.append("p.Category = %s")
            params.append(category)

        where_sql = " AND ".join(f"({item})" for item in where)
        offset = max(page - 1, 0) * page_size
        count_query = f"""
        SELECT COUNT(1) AS total
        FROM POIs p
        LEFT JOIN POITranslations pt ON pt.POIId = p.Id AND pt.LanguageCode = %s
        LEFT JOIN POITranslations ptvi ON ptvi.POIId = p.Id AND ptvi.LanguageCode = 'vi'
        WHERE {where_sql}
        """
        total = self._scalar(count_query, tuple(params)) or 0
        query = f"""
        SELECT p.Id AS id, p.Code AS code,
               COALESCE(pt.Name, ptvi.Name, p.Name, p.Code) AS name,
               COALESCE(pt.ShortDescription, ptvi.ShortDescription, p.ShortDescription) AS shortDescription,
               COALESCE(pt.Description, ptvi.Description, p.Description) AS description,
               p.Latitude AS latitude, p.Longitude AS longitude, p.RadiusMeters AS radiusMeters,
               p.Priority AS priority, p.ImageUrl AS imageUrl, p.Category AS category,
               p.CooldownSeconds AS cooldownSeconds, p.MinDwellSeconds AS minDwellSeconds
        FROM POIs p
        LEFT JOIN POITranslations pt ON pt.POIId = p.Id AND pt.LanguageCode = %s
        LEFT JOIN POITranslations ptvi ON ptvi.POIId = p.Id AND ptvi.LanguageCode = 'vi'
        WHERE {where_sql}
        ORDER BY p.Priority DESC, COALESCE(pt.Name, ptvi.Name, p.Name, p.Code)
        OFFSET %s ROWS FETCH NEXT %s ROWS ONLY
        """
        rows = self._fetchall(query, tuple(params + [offset, page_size]))
        return {"items": rows, "page": page, "pageSize": page_size, "total": total}

    def get_public_poi(self, poi_id: int, language: str) -> dict | None:
        query = f"""
        SELECT p.Id AS id, p.Code AS code,
               COALESCE(pt.Name, ptvi.Name, p.Name, p.Code) AS name,
               COALESCE(pt.ShortDescription, ptvi.ShortDescription, p.ShortDescription) AS shortDescription,
               COALESCE(pt.Description, ptvi.Description, p.Description) AS description,
               p.Latitude AS latitude, p.Longitude AS longitude, p.RadiusMeters AS radiusMeters,
               p.Priority AS priority, p.ImageUrl AS imageUrl, p.Category AS category,
               p.CooldownSeconds AS cooldownSeconds, p.MinDwellSeconds AS minDwellSeconds
        FROM POIs p
        LEFT JOIN POITranslations pt ON pt.POIId = p.Id AND pt.LanguageCode = %s
        LEFT JOIN POITranslations ptvi ON ptvi.POIId = p.Id AND ptvi.LanguageCode = 'vi'
        WHERE p.Id = %s AND {self.PUBLIC_POI_WHERE}
        """
        poi = self._fetchone(query, (language, poi_id))
        if poi:
            poi["audioTracks"] = self.list_audio_tracks_for_poi(poi_id, language)
            poi["images"] = self.list_public_images_for_poi(poi_id)
        return poi

    def list_audio_tracks_for_poi(self, poi_id: int, language: str | None = None) -> list[dict]:
        params: list = [poi_id]
        language_filter = ""
        if language:
            language_filter = "AND a.LanguageCode = %s"
            params.append(language)
        query = f"""
        SELECT a.Id AS id, a.Id AS audioTrackId, a.POIId AS poiId, a.LanguageCode AS languageCode,
               a.LanguageCode AS language, COALESCE(a.Title, CONCAT('POI ', a.POIId, ' - ', a.LanguageCode)) AS title,
               a.AudioType AS audioType, a.DurationSeconds AS durationSeconds,
               a.DurationSeconds AS duration, a.FileSizeBytes AS fileSizeBytes, a.MimeType AS mimeType,
               CASE WHEN a.FileUrl IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS isAvailable
        FROM AudioTracks a
        WHERE a.POIId = %s AND a.IsActive = 1 AND a.DeletedAt IS NULL {language_filter}
        ORDER BY a.LanguageCode, a.Id
        """
        return self._fetchall(query, tuple(params))

    def get_audio_track(self, audio_track_id: int) -> dict | None:
        query = f"""
        SELECT a.Id AS id, a.POIId AS poiId, a.LanguageCode AS languageCode, a.FileUrl AS fileUrl,
               a.MimeType AS mimeType, a.IsActive AS isActive
        FROM AudioTracks a
        INNER JOIN POIs p ON p.Id = a.POIId
        WHERE a.Id = %s AND a.IsActive = 1 AND a.DeletedAt IS NULL AND {self.PUBLIC_POI_WHERE}
        """
        return self._fetchone(query, (audio_track_id,))

    def list_public_images_for_poi(self, poi_id: int) -> list[dict]:
        query = """
        SELECT Id AS id, FileName AS fileName, OriginalFileName AS originalFileName,
               ContentType AS contentType, FileSize AS fileSize, ImageCategory AS imageCategory
        FROM MediaFiles
        WHERE PoiId = %s AND FileType = 'image' AND ApprovalStatus = 'Approved' AND IsDeleted = 0
        ORDER BY UploadedAt DESC
        """
        return self._fetchall(query, (poi_id,))

    def get_public_media_file(self, media_file_id: int) -> dict | None:
        query = f"""
        SELECT m.Id AS id, m.RelativePath AS relativePath, m.ContentType AS contentType
        FROM MediaFiles m
        INNER JOIN POIs p ON p.Id = m.PoiId
        WHERE m.Id = %s AND m.FileType = 'image' AND m.ApprovalStatus = 'Approved'
          AND m.IsDeleted = 0 AND {self.PUBLIC_POI_WHERE}
        """
        return self._fetchone(query, (media_file_id,))

    def get_qr_by_code(self, code: str) -> dict | None:
        query = """
        SELECT q.Id AS id, q.Code AS code, q.Name AS name, q.PoiId AS poiId, q.TourId AS tourId,
               q.IsActive AS isActive, q.RequiresPayment AS requiresPayment,
               q.PriceAmount AS priceAmount, q.AccessDurationMinutes AS accessDurationMinutes,
               q.CreatedAt AS createdAt, q.UpdatedAt AS updatedAt
        FROM QRLocations q
        WHERE q.Code = %s AND q.IsActive = 1 AND q.DeletedAt IS NULL
        """
        return self._fetchone(query, (code,))

    def list_public_packages(self) -> list[dict]:
        query = """
        SELECT Code AS code, Name AS name, RequiresPayment AS requiresPayment,
               PriceAmount AS priceAmount, AccessDurationMinutes AS accessDurationMinutes
        FROM QRLocations
        WHERE IsActive = 1 AND DeletedAt IS NULL
        ORDER BY PriceAmount, Code
        """
        return self._fetchall(query)

    def create_guest_pass(self, qr_id: int, amount, currency: str, expires_at: datetime, is_paid: bool, status: str, token_hash: str | None, starts_at: datetime | None) -> int:
        query = """
        INSERT INTO GuestAccessPasses (QrLocationId, Amount, Currency, ExpiresAt, IsPaid, Status, TokenHash, StartsAt, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, SYSUTCDATETIME(), SYSUTCDATETIME())
        """
        return int(self._scalar(query, (qr_id, amount, currency, expires_at, is_paid, status, token_hash, starts_at)))

    def create_payment_session(self, pass_id: int, amount, currency: str, expires_at: datetime) -> int:
        query = """
        INSERT INTO AccessPaymentSessions (GuestAccessPassId, Provider, Status, Amount, Currency, CreatedAt, ExpiresAt)
        OUTPUT INSERTED.Id
        VALUES (%s, 'SimulatedMoMo', 'Pending', %s, %s, SYSUTCDATETIME(), %s)
        """
        return int(self._scalar(query, (pass_id, amount, currency, expires_at)))

    def get_pass_by_token_hash(self, token_hash: str) -> dict | None:
        query = """
        SELECT p.Id AS id, p.QrLocationId AS qrLocationId, p.ExpiresAt AS expiresAt, p.Status AS status,
               q.PoiId AS poiId, q.TourId AS tourId
        FROM GuestAccessPasses p
        INNER JOIN QRLocations q ON q.Id = p.QrLocationId AND q.DeletedAt IS NULL
        WHERE p.TokenHash = %s
        """
        return self._fetchone(query, (token_hash,))

    def get_payment_session(self, session_id: int) -> dict | None:
        query = """
        SELECT s.Id AS id, s.Status AS sessionStatus, s.ExpiresAt AS sessionExpiresAt,
               p.Id AS passId, p.Status AS passStatus, p.QrLocationId AS qrLocationId,
               q.PoiId AS poiId, q.TourId AS tourId, q.AccessDurationMinutes AS accessDurationMinutes
        FROM AccessPaymentSessions s
        INNER JOIN GuestAccessPasses p ON p.Id = s.GuestAccessPassId
        INNER JOIN QRLocations q ON q.Id = p.QrLocationId
        WHERE s.Id = %s
        """
        return self._fetchone(query, (session_id,))

    def mark_payment_session(self, session_id: int, pass_id: int, session_status: str, pass_status: str, token_hash: str | None = None, expires_at: datetime | None = None) -> None:
        paid_sql = ", PaidAt = SYSUTCDATETIME()" if session_status == "Paid" else ""
        pass_sql = ", TokenHash = %s, StartsAt = SYSUTCDATETIME(), ExpiresAt = %s, IsPaid = 1" if token_hash else ""
        params: list = [session_status, session_id, pass_status]
        if token_hash:
            params.extend([token_hash, expires_at])
        params.append(pass_id)
        query = f"""
        UPDATE AccessPaymentSessions SET Status = %s{paid_sql} WHERE Id = %s;
        UPDATE GuestAccessPasses SET Status = %s, UpdatedAt = SYSUTCDATETIME(){pass_sql} WHERE Id = %s;
        """
        self._execute(query, tuple(params))

    def expire_pass(self, pass_id: int) -> None:
        self._execute("UPDATE GuestAccessPasses SET Status = 'Expired', UpdatedAt = SYSUTCDATETIME() WHERE Id = %s", (pass_id,))

    def poi_in_tour(self, tour_id: int, poi_id: int) -> bool:
        return bool(self._scalar("SELECT COUNT(1) AS total FROM TourPOIs WHERE TourId = %s AND POIId = %s", (tour_id, poi_id)))

    def record_play_log(self, poi_id: int, language: str, trigger_type: str, device_id: str | None, duration: int | None = None) -> None:
        known_device = None
        if device_id:
            known_device = self._scalar("SELECT DeviceId FROM Devices WHERE DeviceId = %s", (device_id,))
        query = """
        INSERT INTO NarrationLogs (POIId, TriggerType, LanguageCode, PlayedAt, DurationPlayedSeconds, DeviceId, Synced)
        VALUES (%s, %s, %s, SYSUTCDATETIME(), %s, %s, 1)
        """
        self._execute(query, (poi_id, trigger_type, language, duration, known_device))

    def list_languages(self, active_only: bool = True) -> list[dict]:
        where = "WHERE IsActive = 1" if active_only else ""
        return self._fetchall(f"SELECT Code AS code, Name AS name, NativeName AS nativeName, IsActive AS isActive, SortOrder AS sortOrder FROM Languages {where} ORDER BY SortOrder, Code")

    def get_language(self, code: str) -> dict | None:
        return self._fetchone("SELECT Code AS code, Name AS name, NativeName AS nativeName, IsActive AS isActive, SortOrder AS sortOrder FROM Languages WHERE Code = %s", (code,))

    def public_poi_coordinates(self, poi_id: int | None = None) -> list[dict]:
        where = self.PUBLIC_POI_WHERE
        params: tuple = ()
        if poi_id is not None:
            where = f"p.Id = %s AND {where}"
            params = (poi_id,)
        return self._fetchall(f"SELECT p.Id AS id, p.Latitude AS latitude, p.Longitude AS longitude FROM POIs p WHERE {where}", params)

    def sync_pull(self, since: datetime | None, entity_types: list[str] | None) -> dict:
        since = since or datetime.fromtimestamp(0, tz=timezone.utc).replace(tzinfo=None)
        types = {item.lower() for item in entity_types} if entity_types else None

        def include(name: str) -> bool:
            return types is None or name.lower() in types

        data = {"serverTimestamp": datetime.utcnow(), "pois": [], "poiTranslations": [], "audioTracks": [], "tours": [], "tourTranslations": [], "qrLocations": [], "languages": [], "offlinePackages": [], "deletedRecords": []}
        if include("POI"):
            data["pois"] = self._fetchall("SELECT Id AS id, Code AS code, Name AS name, ShortDescription AS shortDescription, Description AS description, ApprovalStatus AS approvalStatus, UserId AS userId, Latitude AS latitude, Longitude AS longitude, RadiusMeters AS radiusMeters, Priority AS priority, IsActive AS isActive, LifecycleStatus AS lifecycleStatus, ValidFrom AS validFrom, ValidUntil AS validUntil, ImageUrl AS imageUrl, Category AS category, CooldownSeconds AS cooldownSeconds, MinDwellSeconds AS minDwellSeconds, Version AS version, DeletedAt AS deletedAt, UpdatedAt AS updatedAt FROM POIs WHERE UpdatedAt >= %s OR DeletedAt >= %s", (since, since))
        if include("POITranslation"):
            data["poiTranslations"] = self._fetchall("SELECT Id AS id, POIId AS poiId, LanguageCode AS languageCode, Name AS name, Description AS description, ShortDescription AS shortDescription, Version AS version, UpdatedAt AS updatedAt FROM POITranslations WHERE UpdatedAt >= %s", (since,))
        if include("AudioTrack"):
            data["audioTracks"] = self._fetchall("SELECT Id AS id, POIId AS poiId, LanguageCode AS languageCode, AudioType AS audioType, FileUrl AS fileUrl, TTSText AS ttsText, DurationSeconds AS durationSeconds, FileSizeBytes AS fileSizeBytes, MimeType AS mimeType, IsActive AS isActive, Version AS version, DeletedAt AS deletedAt, UpdatedAt AS updatedAt FROM AudioTracks WHERE UpdatedAt >= %s OR DeletedAt >= %s", (since, since))
        if include("Tour"):
            data["tours"] = self._fetchall("SELECT Id AS id, Code AS code, DefaultLanguage AS defaultLanguage, IsActive AS isActive, EstimatedMinutes AS estimatedMinutes, Version AS version, DeletedAt AS deletedAt, UpdatedAt AS updatedAt FROM Tours WHERE UpdatedAt >= %s OR DeletedAt >= %s", (since, since))
        if include("TourTranslation"):
            data["tourTranslations"] = self._fetchall("SELECT Id AS id, TourId AS tourId, LanguageCode AS languageCode, Name AS name, Description AS description FROM TourTranslations")
        if include("QRLocation"):
            data["qrLocations"] = self._fetchall("SELECT Id AS id, Code AS code, PoiId AS poiId, TourId AS tourId, IsActive AS isActive, CreatedAt AS createdAt, UpdatedAt AS updatedAt, DeletedAt AS deletedAt FROM QRLocations WHERE UpdatedAt >= %s OR DeletedAt >= %s", (since, since))
        if include("Language"):
            data["languages"] = self.list_languages(active_only=False)
        if include("OfflinePackage"):
            data["offlinePackages"] = self._fetchall("SELECT Id AS id, TourId AS tourId, LanguageCode AS languageCode, PackageVersion AS packageVersion, DownloadUrl AS downloadUrl, FileSizeBytes AS fileSizeBytes, Checksum AS checksum, IsActive AS isActive, PublishedAt AS publishedAt FROM OfflinePackages WHERE PublishedAt >= %s", (since,))
        data["deletedRecords"] = self._fetchall("SELECT Id AS id, EntityType AS entityType, EntityId AS entityId, DeletedAt AS deletedAt FROM DeletedRecords WHERE DeletedAt >= %s", (since,))
        return data

    def sync_push_logs(self, user_id: int | None, device_id: str | None, logs: list[dict]) -> dict:
        accepted = 0
        rejected = 0
        errors: list[str] = []
        for item in logs:
            poi_id = item.get("poiId") or item.get("POIId")
            if not poi_id or not self._scalar("SELECT COUNT(1) AS total FROM POIs WHERE Id = %s", (poi_id,)):
                rejected += 1
                errors.append(f"POI {poi_id} not found.")
                continue
            self._execute(
                "INSERT INTO NarrationLogs (UserId, POIId, TriggerType, LanguageCode, PlayedAt, DurationPlayedSeconds, DeviceId, Synced) VALUES (%s, %s, %s, %s, %s, %s, %s, 1)",
                (user_id, poi_id, item.get("triggerType", "manual"), item.get("languageCode", "vi"), item.get("playedAt") or datetime.utcnow(), item.get("durationPlayedSeconds"), item.get("deviceId") or device_id),
            )
            accepted += 1
        return {"recordsAccepted": accepted, "recordsRejected": rejected, "serverTimestamp": datetime.utcnow(), "errors": errors}
