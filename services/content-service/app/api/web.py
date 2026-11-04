"""Additive web endpoints; keep existing mobile contracts unchanged."""
from typing import Literal
import base64
import os

import httpx

from fastapi import APIRouter, Depends, Header, Query, HTTPException, Response
from pydantic import BaseModel, Field

from app.api.admin import scoped_user, service as management_service
from app.services.web_service import WebService

router = APIRouter(tags=["web"])
service = WebService()


class GoogleSpeechPreview(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = Field(default="vi", min_length=2, max_length=16)


@router.post("/api/v1/web/google-speech/preview", dependencies=[Depends(scoped_user)])
def google_speech_preview(payload: GoogleSpeechPreview):
    key = os.getenv("GOOGLE_TTS_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "Chưa cấu hình khóa Google Text-to-Speech trên máy chủ.")
    locales = {"vi": "vi-VN", "en": "en-US", "zh": "cmn-CN", "ko": "ko-KR", "ja": "ja-JP", "fr": "fr-FR"}
    locale = locales.get(payload.language.lower().replace("_", "-").split("-")[0])
    if not locale or not payload.text.strip() or len(payload.text.encode("utf-8")) > 5000:
        raise HTTPException(422, "Ngôn ngữ không hỗ trợ hoặc văn bản vượt quá 5000 byte. Hãy chọn đoạn ngắn hơn.")
    try:
        result = httpx.post("https://texttospeech.googleapis.com/v1/text:synthesize",
            headers={"X-Goog-Api-Key": key}, timeout=45,
            json={"input": {"text": payload.text}, "voice": {"languageCode": locale}, "audioConfig": {"audioEncoding": "MP3"}})
    except httpx.HTTPError:
        raise HTTPException(502, "Không kết nối được Google Text-to-Speech.") from None
    if not result.is_success:
        raise HTTPException(502, "Google từ chối tạo giọng đọc. Kiểm tra khóa, quyền API và billing của dự án Google Cloud.")
    try:
        audio = base64.b64decode(result.json()["audioContent"], validate=True)
        if not audio:
            raise ValueError
    except (ValueError, KeyError, TypeError):
        raise HTTPException(502, "Google không trả về âm thanh hợp lệ.") from None
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


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
