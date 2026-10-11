from fastapi import HTTPException

from app.repositories.admin_repository import AdminRepository
from app.services.content_service import ContentService


class WebService:
    def __init__(self, repository=None, content=None):
        self.repository = repository or AdminRepository()
        self.content = content or ContentService()

    def tour_content(self, tour_id):
        tour = self.repository.get_row("tours", tour_id)
        if not tour:
            raise HTTPException(404, "Tour not found")
        return {"tour": tour, "translations": self.repository.tour_translations(tour_id), "pois": self.repository.tour_members(tour_id)}

    def duration_stats(self):
        return self.repository.web_duration()

    def narration_detail(self, poi_id, language_code, token):
        self.content._require_access_for_poi(token, poi_id)
        detail = self.content.get_poi(poi_id, language_code)
        texts = self.repository.web_tts_tracks(poi_id, language_code)
        by_id = {row["id"]: row for row in texts}
        for track in detail.get("audioTracks", []):
            track["ttsText"] = by_id.get(track["id"], {}).get("ttsText")
        return detail

    def tts_play_log(self, payload, token):
        self.content._require_access_for_poi(token, payload.poiId)
        detail = self.content.get_poi(payload.poiId, payload.languageCode)
        if not any(row.get("ttsText") for row in self.repository.web_tts_tracks(detail["id"], payload.languageCode)):
            raise HTTPException(404, "TTS content not found")
        self.content._repository.record_play_log(payload.poiId, self.content._lang(payload.languageCode), self.content._trigger(payload.triggerType), None, payload.durationPlayedSeconds)
        return {"recorded": True}
