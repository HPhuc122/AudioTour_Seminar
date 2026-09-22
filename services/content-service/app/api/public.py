from fastapi import APIRouter, Body, Header, Query
from fastapi.responses import FileResponse

from app.services.content_service import ContentService

router = APIRouter(tags=["public"])
service = ContentService()


def ok(data=None, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


@router.get("/api/v1/public/tours")
def list_tours(lang: str = Query(default="vi")):
    return ok(service.list_tours(lang))


@router.get("/api/v1/public/tours/{tour_id}")
def get_tour(tour_id: int, lang: str = Query(default="vi")):
    return ok(service.get_tour(tour_id, lang))


@router.get("/api/v1/public/pois")
def list_pois(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    lang: str = Query(default="vi"),
):
    return ok(service.list_pois(lang, page, page_size, search, category))


@router.get("/api/v1/public/pois/{poi_id}")
def get_poi(poi_id: int, lang: str = Query(default="vi")):
    return ok(service.get_poi(poi_id, lang))


@router.get("/api/v1/public/audio-tour/tours/{tour_id}")
def get_audio_tour(tour_id: int, language_code: str = Query(default="vi", alias="languageCode"), guest_token: str | None = Header(default=None, alias="X-Guest-Access-Token")):
    return ok(service.get_audio_tour(tour_id, language_code, guest_token))


@router.get("/api/v1/public/audio-tour/pois/{poi_id}")
def get_audio_poi(
    poi_id: int,
    language_code: str = Query(default="vi", alias="languageCode"),
    trigger_type: str = Query(default="manual", alias="triggerType"),
    guest_token: str | None = Header(default=None, alias="X-Guest-Access-Token"),
    device_id: str | None = Header(default=None, alias="X-Guest-Device-Id"),
):
    return ok(service.get_audio_poi(poi_id, language_code, trigger_type, guest_token, device_id))


@router.post("/api/v1/public/access/start")
def start_access(payload: dict = Body(...), device_id: str | None = Header(default=None, alias="X-Guest-Device-Id")):
    return ok(service.start_access(payload.get("qrCode") or payload.get("qr_code"), device_id), "Access flow started")


@router.post("/api/v1/public/access/simulate-payment")
def simulate_payment(payload: dict = Body(...)):
    return ok(service.simulate_payment(int(payload.get("paymentSessionId") or payload.get("payment_session_id") or 0), bool(payload.get("success", True))), "Simulated payment processed")


@router.get("/api/v1/public/access/validate")
def validate_access(access_token: str | None = Query(default=None, alias="accessToken"), guest_token: str | None = Header(default=None, alias="X-Guest-Access-Token")):
    return ok(service.validate_access(guest_token or access_token), "Access validation completed")


@router.get("/api/v1/public/audio/{audio_track_id}")
def stream_audio(audio_track_id: int, guest_token: str | None = Header(default=None, alias="X-Guest-Access-Token")):
    path, media_type = service.stream_audio_info(audio_track_id, guest_token)
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.post("/api/v1/public/audio/{audio_track_id}/play-log")
def record_play(
    audio_track_id: int,
    language_code: str = Query(default="vi", alias="languageCode"),
    trigger_type: str = Query(default="manual", alias="triggerType"),
    duration: int | None = Query(default=None, alias="durationPlayedSeconds"),
    device_id: str | None = Header(default=None, alias="X-Guest-Device-Id"),
):
    return ok(service.record_play(audio_track_id, language_code, trigger_type, device_id, duration), "Audio play recorded")


@router.get("/api/v1/public/media/images/{media_file_id}")
def stream_image(media_file_id: int):
    path, media_type = service.stream_image_info(media_file_id)
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/api/v1/public/packages")
def list_packages():
    return ok(service.list_packages())


@router.get("/api/v1/public/routes/poi-to-poi")
def route_between_pois(from_poi_id: int = Query(alias="fromPoiId"), to_poi_id: int = Query(alias="toPoiId")):
    return ok(service.route_between_pois(from_poi_id, to_poi_id))


@router.get("/api/v1/public/routes/nearest-poi")
def route_to_nearest_poi(from_poi_id: int = Query(alias="fromPoiId")):
    return ok(service.route_to_nearest_poi(from_poi_id))


@router.get("/api/v1/qr/code/{code}")
def get_qr_by_code(code: str):
    return ok(service.get_qr_by_code(code))


@router.get("/api/v1/qr/resolve/{code}")
def resolve_qr(code: str):
    return ok(service.resolve_qr(code))


@router.get("/api/v1/languages")
def list_languages(active_only: bool = Query(default=True, alias="activeOnly")):
    return ok(service.list_languages(active_only))


@router.get("/api/v1/languages/{code}")
def get_language(code: str):
    return ok(service.get_language(code))
