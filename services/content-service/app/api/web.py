"""Additive web endpoints; keep existing mobile contracts unchanged."""
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, Field

from app.api.admin import scoped_user, service as management_service
from app.services.web_service import WebService

router = APIRouter(tags=["web"])
service = WebService()


def ok(data):
    return {"success": True, "message": "Success", "data": data}


@router.get("/api/v1/web/tours/{tour_id}/content", dependencies=[Depends(scoped_user)])
def tour_content(tour_id: int):
    return ok(management_service.tour_content(tour_id))


@router.get("/api/v1/analytics/web-duration", dependencies=[Depends(scoped_user)])
def duration_stats():
    return ok(management_service.duration_stats())


@router.get("/api/v1/public/web-narration/pois/{poi_id}")
def narration_detail(
    poi_id: int,
    language_code: str = Query("vi", alias="languageCode"),
    token: str | None = Header(None, alias="X-Guest-Access-Token"),
):
    # Unlike legacy get_audio_poi, this read does not log a play before playback.
    return ok(service.narration_detail(poi_id, language_code, token))


class WebPlayLog(BaseModel):
    poiId: int = Field(gt=0)
    languageCode: str = Field(min_length=2, max_length=16)
    triggerType: Literal["manual", "gps", "qr"] = "manual"
    durationPlayedSeconds: int = Field(ge=0, le=86400)


@router.post("/api/v1/public/web-narration/play-log")
def tts_play_log(payload: WebPlayLog, token: str | None = Header(None, alias="X-Guest-Access-Token")):
    return ok(service.tts_play_log(payload, token))
