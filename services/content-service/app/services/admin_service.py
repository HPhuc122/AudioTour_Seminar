from __future__ import annotations

import mimetypes
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.repositories.admin_repository import AdminRepository
from app.repositories.content_repository import ContentRepository


class AdminService:
    def __init__(self, repository: AdminRepository | None = None, content_repository: ContentRepository | None = None) -> None:
        self._repository = repository or AdminRepository()
        self._content_repository = content_repository or ContentRepository()

    def list_resource(self, resource: str, include_deleted: bool = False, filters: dict[str, Any] | None = None, page: int = 1, page_size: int = 100) -> dict:
        try:
            return self._repository.list_rows(resource, include_deleted, filters, max(page, 1), min(max(page_size, 1), 500))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    def get_resource(self, resource: str, item_id: Any, include_deleted: bool = False) -> dict:
        row = self._repository.get_row(resource, item_id, include_deleted)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")
        return row

    def create_resource(self, resource: str, payload: dict) -> dict:
        return self._repository.create_row(resource, payload)

    def update_resource(self, resource: str, item_id: Any, payload: dict) -> dict:
        return self._repository.update_row(resource, item_id, payload)

    def delete_resource(self, resource: str, item_id: Any) -> None:
        self._repository.delete_row(resource, item_id)

    def restore_resource(self, resource: str, item_id: Any) -> None:
        self._repository.restore_row(resource, item_id)

    def by_column(self, resource: str, column: str, value: Any, include_deleted: bool = False) -> list[dict]:
        try:
            return self._repository.by_column(resource, column, value, include_deleted)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    def poi_transition(self, poi_id: int, action: str, payload: dict | None = None) -> dict:
        payload = payload or {}
        transitions = {
            "approval-status": {"ApprovalStatus": payload.get("approvalStatus", payload.get("status", 1))},
            "approve-review": {"ApprovalStatus": 1, "LifecycleStatus": 1},
            "request-payment": {"PaymentRequired": True, "PaymentStatus": 1, "LifecycleStatus": 2},
            "reject": {"ApprovalStatus": 2, "LifecycleStatus": 5},
            "mark-paid": {"PaymentStatus": 2, "LifecycleStatus": 3, "IsActive": True},
            "waive-payment": {"PaymentStatus": 3, "LifecycleStatus": 3, "IsActive": True},
        }
        if action not in transitions:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported POI action")
        return self.update_resource("pois", poi_id, transitions[action])

    def start_poi_payment(self, poi_id: int) -> dict:
        poi = self.get_resource("pois", poi_id, include_deleted=True)
        return {"poiId": poi_id, "status": "Pending", "amount": 0, "currency": "VND", "paymentRequired": bool(poi.get("PaymentRequired"))}

    def simulate_poi_payment(self, poi_id: int, success: bool = True) -> dict:
        if success:
            poi = self.poi_transition(poi_id, "mark-paid")
            return {"poiId": poi_id, "status": "Paid", "poi": poi}
        return {"poiId": poi_id, "status": "Failed"}

    def add_tour_translation(self, tour_id: int, payload: dict) -> dict:
        return self._repository.add_tour_translation(tour_id, payload)

    def update_tour_translation(self, translation_id: int, payload: dict) -> dict:
        return self._repository.update_tour_translation(translation_id, payload)

    def delete_tour_translation(self, translation_id: int) -> None:
        self._repository.execute("DELETE FROM TourTranslations WHERE Id = %s", (translation_id,))

    def add_tour_poi(self, tour_id: int, payload: dict) -> dict:
        return self._repository.add_tour_poi(tour_id, payload)

    def remove_tour_poi(self, tour_id: int, poi_id: int) -> None:
        self._repository.execute("DELETE FROM TourPOIs WHERE TourId = %s AND POIId = %s", (tour_id, poi_id))

    def reorder_tour_pois(self, tour_id: int, payload: dict | list) -> list[dict]:
        items = payload if isinstance(payload, list) else payload.get("items") or payload.get("pois") or []
        return self._repository.reorder_tour_pois(tour_id, items)

    def geofence_by_poi(self, poi_id: int) -> dict:
        poi = self.get_resource("pois", poi_id)
        return {"poiId": poi_id, "radiusMeters": poi.get("RadiusMeters"), "cooldownSeconds": poi.get("CooldownSeconds"), "minDwellSeconds": poi.get("MinDwellSeconds"), "latitude": poi.get("Latitude"), "longitude": poi.get("Longitude")}

    def update_geofence(self, poi_id: int, payload: dict) -> dict:
        return self.update_resource("pois", poi_id, {"RadiusMeters": payload.get("radiusMeters"), "CooldownSeconds": payload.get("cooldownSeconds"), "MinDwellSeconds": payload.get("minDwellSeconds"), "Latitude": payload.get("latitude"), "Longitude": payload.get("longitude")})

    def analytics_daily(self) -> list[dict]:
        return self._repository.fetchall("SELECT * FROM AnalyticsDaily ORDER BY Date DESC")

    def analytics_summary(self) -> dict:
        return self._repository.analytics_summary()

    def analytics_grouped(self, group_by: str = "poi") -> list[dict]:
        if group_by.lower() == "date":
            return self._repository.fetchall("SELECT CONVERT(date, PlayedAt) AS groupKey, COUNT(1) AS plays FROM NarrationLogs GROUP BY CONVERT(date, PlayedAt) ORDER BY groupKey DESC")
        return self._repository.fetchall("SELECT POIId AS groupKey, COUNT(1) AS plays FROM NarrationLogs GROUP BY POIId ORDER BY plays DESC")

    def dashboard(self) -> dict:
        return self.analytics_summary()

    def sync_pull(self, payload: dict) -> dict:
        return self._content_repository.sync_pull(payload.get("since"), payload.get("entityTypes"))

    def sync_push(self, payload: dict) -> dict:
        user_id = payload.get("userId") if payload.get("userId", 0) > 0 else None
        return self._content_repository.sync_push_logs(user_id, payload.get("deviceId"), payload.get("narrationLogs") or [])

    def create_narration(self, payload: dict, user_id: int | None) -> dict:
        data = {
            "Title": payload.get("title") or payload.get("Title") or "Narration draft",
            "LanguageCode": payload.get("languageCode") or payload.get("LanguageCode") or "vi",
            "TextContent": payload.get("textContent") or payload.get("TextContent") or "",
            "Voice": payload.get("voice") or payload.get("Voice") or "vi-VN",
            "PoiId": payload.get("poiId") or payload.get("PoiId"),
            "Status": payload.get("status") or "Pending",
            "SubmittedByUserId": user_id or payload.get("submittedByUserId") or 1,
        }
        return self.create_resource("narrations", data)

    def narration_action(self, draft_id: int, action: str, payload: dict | None, user_id: int | None) -> dict:
        payload = payload or {}
        if action == "approve":
            return self.update_resource("narrations", draft_id, {"Status": "Approved", "ReviewedByUserId": user_id, "ReviewedAt": None})
        if action == "reject":
            return self.update_resource("narrations", draft_id, {"Status": "Rejected", "ReviewedByUserId": user_id, "RejectionReason": payload.get("reason")})
        if action == "text":
            return self.update_resource("narrations", draft_id, {"TextContent": payload.get("textContent") or payload.get("text")})
        if action == "translations":
            draft = self.get_resource("narrations", draft_id)
            return {"sourceDraftId": draft_id, "languageCodes": payload.get("languageCodes") or [], "textContent": draft.get("TextContent")}
        if action == "generate-audio":
            return self.update_resource("narrations", draft_id, {"SimulatedAudioUrl": f"uploads/audio/narration-{draft_id}.mp3"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported narration action")

    def upload_media(self, file: UploadFile, poi_id: int | None, image_category: str | None, user_id: int | None, approved: bool = False) -> dict:
        content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        folder = "images" if content_type.startswith("image/") else "audio"
        extension = Path(file.filename or "upload.bin").suffix or mimetypes.guess_extension(content_type) or ".bin"
        file_name = f"{uuid.uuid4().hex}{extension}"
        root = Path(settings.media_root).resolve()
        target_dir = root / "uploads" / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / file_name
        with target.open("wb") as output:
            shutil.copyfileobj(file.file, output)
        relative_path = f"uploads/{folder}/{file_name}"
        return self._repository.save_media_file(file_name, file.filename or file_name, content_type, target.stat().st_size, relative_path, user_id, poi_id, image_category, "Approved" if approved else "Pending")

    def approve_media(self, media_id: int, user_id: int | None) -> dict:
        return self.update_resource("media", media_id, {"ApprovalStatus": "Approved", "ReviewedByUserId": user_id, "ReviewedAt": None})

    def reject_media(self, media_id: int, payload: dict, user_id: int | None) -> dict:
        return self.update_resource("media", media_id, {"ApprovalStatus": "Rejected", "ReviewedByUserId": user_id, "RejectionReason": payload.get("reason")})
