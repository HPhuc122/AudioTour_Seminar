import hashlib
import math
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings
from app.repositories.content_repository import ContentRepository


class ContentService:
    def __init__(self, repository: ContentRepository | None = None) -> None:
        self._repository = repository or ContentRepository()

    def list_tours(self, language: str) -> list[dict]:
        return self._repository.list_public_tours(self._lang(language))

    def get_tour(self, tour_id: int, language: str) -> dict:
        tour = self._repository.get_public_tour(tour_id, self._lang(language))
        if tour is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tour not found")
        return tour

    def list_pois(self, language: str, page: int = 1, page_size: int = 20, search: str | None = None, category: str | None = None) -> dict:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        return self._repository.list_public_pois(self._lang(language), page, page_size, search, category)

    def get_poi(self, poi_id: int, language: str) -> dict:
        poi = self._repository.get_public_poi(poi_id, self._lang(language))
        if poi is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="POI not found")
        return poi

    def get_audio_tour(self, tour_id: int, language: str, token: str | None) -> dict:
        self._require_access_for_tour(token, tour_id)
        return self.get_tour(tour_id, language)

    def get_audio_poi(self, poi_id: int, language: str, trigger_type: str, token: str | None, device_id: str | None) -> dict:
        self._require_access_for_poi(token, poi_id)
        poi = self.get_poi(poi_id, language)
        self._repository.record_play_log(poi_id, self._lang(language), self._trigger(trigger_type), device_id)
        return poi

    def start_access(self, qr_code: str, device_id: str | None = None) -> dict:
        if not qr_code or not qr_code.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="QR code is required")
        qr = self._repository.get_qr_by_code(qr_code.strip())
        if qr is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
        duration = int(qr.get("accessDurationMinutes") or 60)
        if duration <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Access duration must be greater than zero")
        amount = qr.get("priceAmount") or 0
        requires_payment = bool(qr.get("requiresPayment"))
        now = datetime.utcnow()
        token = None if requires_payment else secrets.token_urlsafe(32)
        pass_id = self._repository.create_guest_pass(
            qr["id"],
            amount if requires_payment else 0,
            "VND",
            now + timedelta(minutes=duration),
            not requires_payment,
            "PendingPayment" if requires_payment else "Active",
            self._hash_token(token) if token else None,
            now if token else None,
        )
        payment_session_id = None
        if requires_payment:
            payment_session_id = self._repository.create_payment_session(pass_id, amount, "VND", now + timedelta(minutes=15))
        elif qr.get("poiId"):
            self._repository.record_play_log(qr["poiId"], "vi", "qr", device_id)
        return {
            "qr": qr,
            "requiresPayment": requires_payment,
            "amount": amount if requires_payment else 0,
            "currency": "VND",
            "accessDurationMinutes": duration,
            "paymentSessionId": payment_session_id,
            "status": "PendingPayment" if requires_payment else "Active",
            "accessToken": token,
            "expiresAt": now + timedelta(minutes=duration) if token else None,
        }

    def simulate_payment(self, payment_session_id: int, success: bool = True) -> dict:
        session = self._repository.get_payment_session(payment_session_id)
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment session not found")
        if session["sessionStatus"] == "Paid" and session["passStatus"] == "Active":
            return self._payment_response(session, None)
        if session["sessionStatus"] != "Pending" or session["passStatus"] != "PendingPayment":
            return self._payment_response(session, None)
        if session["sessionExpiresAt"] <= datetime.utcnow():
            self._repository.mark_payment_session(payment_session_id, session["passId"], "Expired", "Expired")
            session["passStatus"] = "Expired"
            return self._payment_response(session, None)
        if not success:
            self._repository.mark_payment_session(payment_session_id, session["passId"], "Failed", "Failed")
            session["passStatus"] = "Failed"
            return self._payment_response(session, None)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=int(session.get("accessDurationMinutes") or 60))
        self._repository.mark_payment_session(payment_session_id, session["passId"], "Paid", "Active", self._hash_token(token), expires_at)
        session["passStatus"] = "Active"
        session["expiresAt"] = expires_at
        if session.get("poiId"):
            self._repository.record_play_log(session["poiId"], "vi", "qr", None)
        return self._payment_response(session, token, expires_at)

    def validate_access(self, token: str | None) -> dict:
        access_pass = self._get_pass(token)
        if not access_pass:
            return {"isValid": False, "status": "MissingToken" if not token else "InvalidToken", "remainingSeconds": 0}
        if access_pass["status"] != "Active":
            return self._validate_response(access_pass, False)
        if access_pass["expiresAt"] <= datetime.utcnow():
            self._repository.expire_pass(access_pass["id"])
            access_pass["status"] = "Expired"
            return self._validate_response(access_pass, False)
        return self._validate_response(access_pass, True)

    def stream_audio_info(self, audio_track_id: int, token: str | None) -> tuple[Path, str]:
        track = self._repository.get_audio_track(audio_track_id)
        if track is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio track not found")
        self._require_access_for_poi(token, track["poiId"])
        return self._resolve_media_path(track["fileUrl"], "uploads/audio"), track.get("mimeType") or "audio/mpeg"

    def record_play(self, audio_track_id: int, language: str, trigger_type: str, device_id: str | None, duration: int | None = None) -> dict:
        track = self._repository.get_audio_track(audio_track_id)
        if track is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio track not found")
        self._repository.record_play_log(track["poiId"], self._lang(language), self._trigger(trigger_type), device_id, duration)
        return {"recorded": True}

    def stream_image_info(self, media_file_id: int) -> tuple[Path, str]:
        media = self._repository.get_public_media_file(media_file_id)
        if media is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")
        return self._resolve_media_path(media["relativePath"], "uploads/images"), media.get("contentType") or "image/jpeg"

    def get_qr_by_code(self, code: str) -> dict:
        qr = self._repository.get_qr_by_code(code)
        if qr is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
        return qr

    def resolve_qr(self, code: str) -> dict:
        qr = self.get_qr_by_code(code)
        target_type = "poi" if qr.get("poiId") else "tour"
        return {**qr, "targetType": target_type, "targetId": qr.get("poiId") or qr.get("tourId")}

    def list_packages(self) -> list[dict]:
        base_url = settings.public_web_base_url.rstrip("/")
        packages = self._repository.list_public_packages()
        for package in packages:
            package["publicQrUrl"] = f"{base_url}/qr/{package['code']}"
        return packages

    def list_languages(self, active_only: bool = True) -> list[dict]:
        return self._repository.list_languages(active_only)

    def get_language(self, code: str) -> dict:
        language = self._repository.get_language(code)
        if language is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
        return language

    def route_between_pois(self, from_poi_id: int, to_poi_id: int) -> dict:
        if from_poi_id == to_poi_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please choose two different POIs")
        coords = self._repository.public_poi_coordinates()
        by_id = {item["id"]: item for item in coords}
        if from_poi_id not in by_id or to_poi_id not in by_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public POI not found")
        return self._route_result(by_id[from_poi_id], by_id[to_poi_id])

    def route_to_nearest_poi(self, from_poi_id: int) -> dict:
        coords = self._repository.public_poi_coordinates()
        by_id = {item["id"]: item for item in coords}
        if from_poi_id not in by_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public POI not found")
        origin = by_id[from_poi_id]
        candidates = [item for item in coords if item["id"] != from_poi_id]
        if not candidates:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No other public POI is available")
        nearest = min(candidates, key=lambda item: self._distance(origin, item))
        return self._route_result(origin, nearest)

    def sync_pull(self, payload: dict) -> dict:
        return self._repository.sync_pull(payload.get("since"), payload.get("entityTypes"))

    def sync_push(self, payload: dict) -> dict:
        user_id = payload.get("userId") if payload.get("userId", 0) > 0 else None
        return self._repository.sync_push_logs(user_id, payload.get("deviceId"), payload.get("narrationLogs") or [])

    def _get_pass(self, token: str | None) -> dict | None:
        if not token or not token.strip():
            return None
        return self._repository.get_pass_by_token_hash(self._hash_token(token.strip()))

    def _require_access_for_tour(self, token: str | None, tour_id: int) -> None:
        result = self.validate_access(token)
        if not result.get("isValid"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Guest access token is invalid")
        if result.get("tourId") and result.get("tourId") != tour_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access pass does not allow this tour")

    def _require_access_for_poi(self, token: str | None, poi_id: int) -> None:
        result = self.validate_access(token)
        if not result.get("isValid"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Guest access token is invalid")
        if result.get("poiId") == poi_id:
            return
        if result.get("tourId") and self._repository.poi_in_tour(result["tourId"], poi_id):
            return
        if result.get("poiId") or result.get("tourId"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access pass does not allow this POI")

    def _resolve_media_path(self, relative_path: str | None, expected_prefix: str) -> Path:
        if not relative_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        normalized = relative_path.strip().replace("\\", "/").lstrip("/")
        if not normalized.lower().startswith(expected_prefix.lower() + "/"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        root = Path(settings.media_root).resolve()
        path = (root / normalized).resolve()
        if root not in path.parents:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="File path is not allowed")
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return path

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest().upper()

    @staticmethod
    def _lang(language: str | None) -> str:
        return language.strip().lower() if language and language.strip() else "vi"

    @staticmethod
    def _trigger(trigger_type: str | None) -> str:
        value = trigger_type.strip().lower() if trigger_type else "manual"
        return value if value in {"gps", "qr", "manual"} else "manual"

    @staticmethod
    def _validate_response(access_pass: dict, valid: bool) -> dict:
        seconds = max(0, int((access_pass["expiresAt"] - datetime.utcnow()).total_seconds())) if valid else 0
        return {"isValid": valid, "status": access_pass["status"], "expiresAt": access_pass.get("expiresAt") if valid else None, "remainingSeconds": seconds, "qrLocationId": access_pass.get("qrLocationId"), "poiId": access_pass.get("poiId"), "tourId": access_pass.get("tourId")}

    @staticmethod
    def _payment_response(session: dict, token: str | None, expires_at: datetime | None = None) -> dict:
        return {"status": session.get("passStatus"), "accessToken": token, "expiresAt": expires_at, "qrLocationId": session.get("qrLocationId"), "poiId": session.get("poiId"), "tourId": session.get("tourId")}

    @staticmethod
    def _distance(a: dict, b: dict) -> float:
        radius = 6371000
        lat1 = math.radians(float(a["latitude"]))
        lat2 = math.radians(float(b["latitude"]))
        dlat = lat2 - lat1
        dlon = math.radians(float(b["longitude"]) - float(a["longitude"]))
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return radius * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))

    def _route_result(self, origin: dict, target: dict) -> dict:
        distance = self._distance(origin, target)
        return {"fromPoiId": origin["id"], "toPoiId": target["id"], "directDistanceMeters": distance, "routeDistanceMeters": distance, "durationSeconds": distance / 1.2, "latLngs": [{"latitude": origin["latitude"], "longitude": origin["longitude"]}, {"latitude": target["latitude"], "longitude": target["longitude"]}]}
