from __future__ import annotations

from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from jose import JWTError, jwt

from app.core.config import settings
from app.services.review_service import ReviewService
from app.core.access import actor, MANAGEMENT_ROLES, WRITE_ROLES, ADMIN_ROLES

service = ReviewService()


def ok(data=None, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


def current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is required"
        )
    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1].strip(),
            settings.jwt_secret,
            algorithms=["HS256"],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    role = payload.get("role")
    if role not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role"
        )
    try:
        uid = int(payload.get("sub") or 0)
    except (TypeError, ValueError):
        raise HTTPException(401, "Invalid subject")
    record = service._repository.fetchone(
        "SELECT u.Id, r.Name AS Role FROM Users u INNER JOIN Roles r ON r.Id=u.RoleId WHERE u.Id=%s AND u.IsActive=1",
        (uid,),
    )
    if not record or record["Role"] != role:
        raise HTTPException(401, "Account disabled or role changed; sign in again")
    return {"id": uid, "username": payload.get("username"), "role": role}


def require_write(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Write role is required"
        )
    return user


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin role is required"
        )
    return user


async def scoped_user(value: dict = Depends(current_user)):
    token = actor.set(value)
    try:
        yield value
    finally:
        actor.reset(token)


router = APIRouter(tags=["admin"], dependencies=[Depends(scoped_user)])


def filters(**kwargs):
    return {key: value for key, value in kwargs.items() if value is not None}


@router.get("/api/v1/pois")
def list_pois(
    page: int = 1,
    pageSize: int = 100,
    includeDeleted: bool = False,
    category: str | None = None,
    userId: int | None = None,
):
    return ok(
        service.list_resource(
            "pois",
            includeDeleted,
            filters(Category=category, UserId=userId),
            page,
            pageSize,
        )
    )


@router.get("/api/v1/pois/{id}")
def get_poi(id: int):
    return ok(service.get_resource("pois", id, include_deleted=True))


@router.get("/api/v1/pois/by-code/{code}")
def get_poi_by_code(code: str):
    items = service.by_column("pois", "Code", code, include_deleted=True)
    if not items:
        raise HTTPException(status_code=404, detail="POI not found")
    return ok(items[0])


@router.post("/api/v1/pois")
def create_poi(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.create_resource("pois", payload), "POI created")


@router.put("/api/v1/pois/{id}")
def update_poi(id: int, payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.update_resource("pois", id, payload), "POI updated")


@router.put("/api/v1/pois/{id}/approval-status")
def update_poi_approval(
    id: int, payload: dict = Body(...), _: dict = Depends(require_admin)
):
    return ok(
        service.poi_transition(id, "approval-status", payload),
        "POI approval status updated",
    )


@router.post("/api/v1/pois/{id}/approve-review")
def approve_review(id: int, _: dict = Depends(require_admin)):
    return ok(service.poi_transition(id, "approve-review"), "POI review approved")


@router.post("/api/v1/pois/{id}/request-payment")
def request_payment(id: int, _: dict = Depends(require_admin)):
    return ok(service.poi_transition(id, "request-payment"), "POI payment requested")


@router.post("/api/v1/pois/{id}/reject")
def reject_poi(
    id: int,
    payload: dict = Body(default_factory=dict),
    _: dict = Depends(require_admin),
):
    return ok(service.poi_transition(id, "reject", payload), "POI rejected")


@router.post("/api/v1/pois/{id}/mark-paid")
def mark_paid(id: int, _: dict = Depends(require_admin)):
    return ok(service.poi_transition(id, "mark-paid"), "POI marked paid")


@router.post("/api/v1/pois/{id}/waive-payment")
def waive_payment(id: int, _: dict = Depends(require_admin)):
    return ok(service.poi_transition(id, "waive-payment"), "POI payment waived")


@router.post("/api/v1/pois/{id}/payment/start")
def start_poi_payment(id: int, _: dict = Depends(require_write)):
    return ok(service.start_poi_payment(id), "POI payment started")


@router.post("/api/v1/pois/{id}/payment/simulate-momo")
def simulate_poi_payment(
    id: int,
    payload: dict = Body(default_factory=dict),
    _: dict = Depends(require_admin),
):
    return ok(
        service.simulate_poi_payment(id, bool(payload.get("success", True))),
        "POI payment simulated",
    )


@router.delete("/api/v1/pois/{id}")
def delete_poi(id: int, _: dict = Depends(require_write)):
    service.delete_resource("pois", id)
    return ok("POI deleted")


@router.put("/api/v1/pois/{id}/restore")
def restore_poi(id: int, _: dict = Depends(require_write)):
    service.restore_resource("pois", id)
    return ok("POI restored")


@router.get("/api/v1/tours")
def list_tours(page: int = 1, pageSize: int = 100, includeDeleted: bool = False):
    return ok(service.list_resource("tours", includeDeleted, None, page, pageSize))


@router.get("/api/v1/tours/{id}")
def get_tour(id: int):
    return ok(service.get_resource("tours", id, include_deleted=True))


@router.post("/api/v1/tours")
def create_tour(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.create_resource("tours", payload), "Tour created")


@router.put("/api/v1/tours/{id}")
def update_tour(id: int, payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.update_resource("tours", id, payload), "Tour updated")


@router.delete("/api/v1/tours/{id}")
def delete_tour(id: int, _: dict = Depends(require_write)):
    service.delete_resource("tours", id)
    return ok("Tour deleted")


@router.post("/api/v1/tours/{tourId}/translations")
def add_tour_translation(
    tourId: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(service.add_tour_translation(tourId, payload), "Tour translation created")


@router.put("/api/v1/tours/translations/{translationId}")
def update_tour_translation(
    translationId: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(
        service.update_tour_translation(translationId, payload),
        "Tour translation updated",
    )


@router.delete("/api/v1/tours/translations/{translationId}")
def delete_tour_translation(translationId: int, _: dict = Depends(require_write)):
    service.delete_tour_translation(translationId)
    return ok("Tour translation deleted")


@router.post("/api/v1/tours/{tourId}/pois")
def add_tour_poi(
    tourId: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(service.add_tour_poi(tourId, payload), "Tour POI added")


@router.delete("/api/v1/tours/{tourId}/pois/{poiId}")
def remove_tour_poi(tourId: int, poiId: int, _: dict = Depends(require_write)):
    service.remove_tour_poi(tourId, poiId)
    return ok("Tour POI removed")


@router.put("/api/v1/tours/{tourId}/pois/reorder")
def reorder_tour_pois(
    tourId: int, payload: dict | list = Body(...), _: dict = Depends(require_write)
):
    return ok(service.reorder_tour_pois(tourId, payload), "Tour POIs reordered")


@router.get("/api/v1/audio/{id}")
def get_audio(id: int):
    return ok(service.get_resource("audio", id, include_deleted=True))


@router.get("/api/v1/audio/by-poi/{poiId}")
def audio_by_poi(poiId: int):
    return ok(service.by_column("audio", "POIId", poiId, include_deleted=True))


@router.post("/api/v1/audio")
def create_audio(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.create_resource("audio", payload), "Audio track created")


@router.put("/api/v1/audio/{id}")
def update_audio(id: int, payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.update_resource("audio", id, payload), "Audio track updated")


@router.delete("/api/v1/audio/{id}")
def delete_audio(id: int, _: dict = Depends(require_write)):
    service.delete_resource("audio", id)
    return ok("Audio track deleted")


@router.get("/api/v1/qr")
def list_qr(page: int = 1, pageSize: int = 100, includeDeleted: bool = False):
    return ok(service.list_resource("qr", includeDeleted, None, page, pageSize))


@router.get("/api/v1/qr/{id}")
def get_qr(id: int):
    return ok(service.get_resource("qr", id, include_deleted=True))


@router.post("/api/v1/qr")
def create_qr(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.create_resource("qr", payload), "QR location created")


@router.put("/api/v1/qr/{id}")
def update_qr(id: int, payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.update_resource("qr", id, payload), "QR location updated")


@router.delete("/api/v1/qr/{id}")
def delete_qr(id: int, _: dict = Depends(require_write)):
    service.delete_resource("qr", id)
    return ok("QR location deleted")


@router.post("/api/v1/languages")
def create_language(payload: dict = Body(...), _: dict = Depends(require_admin)):
    return ok(service.create_resource("languages", payload), "Language created")


@router.put("/api/v1/languages/{code}")
def update_language(
    code: str, payload: dict = Body(...), _: dict = Depends(require_admin)
):
    return ok(service.update_resource("languages", code, payload), "Language updated")


@router.delete("/api/v1/languages/{code}")
def delete_language(code: str, _: dict = Depends(require_admin)):
    service.delete_resource("languages", code)
    return ok("Language deleted")


@router.get("/api/v1/geofence/by-poi/{poiId}")
def get_geofence(poiId: int):
    return ok(service.geofence_by_poi(poiId))


@router.put("/api/v1/geofence/by-poi/{poiId}")
def update_geofence(
    poiId: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(service.update_geofence(poiId, payload), "Geofence config updated")


@router.get("/api/v1/analytics/daily")
def analytics_daily():
    return ok(service.analytics_daily())


@router.get("/api/v1/analytics/summary")
def analytics_summary():
    return ok(service.analytics_summary())


@router.get("/api/v1/analytics/grouped")
def analytics_grouped(groupBy: str = "poi"):
    return ok(service.analytics_grouped(groupBy))


@router.get("/api/v1/analytics/dashboard")
def analytics_dashboard():
    return ok(service.dashboard())


@router.post("/api/v1/sync/pull")
def sync_pull(
    payload: dict = Body(default_factory=dict), _: dict = Depends(require_write)
):
    return ok(service.sync_pull(payload))


@router.post("/api/v1/sync/push")
def sync_push(
    payload: dict = Body(default_factory=dict), _: dict = Depends(require_write)
):
    return ok(service.sync_push(payload))


@router.get("/api/v1/narration-logs")
def list_narration_logs(
    page: int = 1,
    pageSize: int = 100,
    poiId: int | None = None,
    deviceId: str | None = None,
):
    return ok(
        service.list_resource(
            "narration_logs",
            False,
            filters(POIId=poiId, DeviceId=deviceId),
            page,
            pageSize,
        )
    )


@router.post("/api/v1/narration-logs")
def create_narration_log(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(
        service.create_resource("narration_logs", payload), "Narration log created"
    )


@router.get("/api/v1/media")
def list_media(
    page: int = 1,
    pageSize: int = 100,
    includeDeleted: bool = False,
    fileType: str | None = None,
    poiId: int | None = None,
):
    return ok(
        service.list_resource(
            "media",
            includeDeleted,
            filters(FileType=fileType, PoiId=poiId),
            page,
            pageSize,
        )
    )


@router.get("/api/v1/media/search")
def search_media(
    page: int = 1,
    pageSize: int = 100,
    fileType: str | None = None,
    poiId: int | None = None,
):
    return ok(
        service.list_resource(
            "media", False, filters(FileType=fileType, PoiId=poiId), page, pageSize
        )
    )


@router.get("/api/v1/media/by-poi/{poiId}")
def media_by_poi(poiId: int):
    return ok(service.by_column("media", "PoiId", poiId))


@router.get("/api/v1/media/{id}")
def get_media(id: int):
    return ok(service.get_resource("media", id, include_deleted=True))


@router.post("/api/v1/media/upload")
def upload_media(
    file: UploadFile = File(...),
    poiId: int | None = None,
    imageCategory: str | None = None,
    user: dict = Depends(require_write),
):
    return ok(
        service.upload_media(
            file, poiId, imageCategory, user.get("id"), approved=False
        ),
        "Media file uploaded",
    )


@router.post("/api/v1/media/{id}/approve")
def approve_media(id: int, user: dict = Depends(require_admin)):
    return ok(service.approve_media(id, user.get("id")), "Media file approved")


@router.post("/api/v1/media/{id}/replacement")
def replace_media(
    id: int, file: UploadFile = File(...), _: dict = Depends(require_write)
):
    return ok(service.replace_media(id, file), "Replacement submitted for review")


@router.post("/api/v1/media/{id}/reject")
def reject_media(
    id: int,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_admin),
):
    return ok(service.reject_media(id, payload, user.get("id")), "Media file rejected")


@router.delete("/api/v1/media/{id}")
def delete_media(id: int, _: dict = Depends(require_write)):
    service.delete_resource("media", id)
    return ok("Media file deleted")


@router.post("/api/v1/media/{id}/restore")
def restore_media(id: int, _: dict = Depends(require_write)):
    service.restore_resource("media", id)
    return ok("Media file restored")


@router.get("/api/v1/narrations")
def list_narrations(
    page: int = 1,
    pageSize: int = 100,
    poiId: int | None = None,
    status: str | None = None,
):
    return ok(
        service.list_resource(
            "narrations", False, filters(PoiId=poiId, Status=status), page, pageSize
        )
    )


@router.get("/api/v1/narrations/by-poi/{poiId}")
def narrations_by_poi(poiId: int):
    return ok(service.by_column("narrations", "PoiId", poiId))


@router.get("/api/v1/narrations/{id}")
def get_narration(id: int):
    return ok(service.get_resource("narrations", id))


@router.get("/api/v1/tours/translations/{id}")
def get_tour_translation(id: int):
    return ok(service.get_resource("tour-translations", id))


@router.post("/api/v1/narrations")
def create_narration(payload: dict = Body(...), user: dict = Depends(require_write)):
    return ok(
        service.create_narration(payload, user.get("id")), "Narration draft created"
    )


@router.post("/api/v1/narrations/{id}/{action}")
def narration_action(
    id: int,
    action: str,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_write),
):
    return ok(
        service.narration_action(id, action, payload, user.get("id")),
        "Narration draft updated",
    )


@router.put("/api/v1/narrations/{id}/text")
def update_narration_text(
    id: int, payload: dict = Body(...), user: dict = Depends(require_write)
):
    return ok(
        service.narration_action(id, "text", payload, user.get("id")),
        "Narration text updated",
    )


@router.put("/api/v1/narrations/{id}/content")
def update_narration_content(
    id: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(service.update_resource("narrations", id, payload))


@router.post("/api/v1/narrations/{id}/translations")
def narration_translations(
    id: int,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_write),
):
    return ok(
        service.narration_action(id, "translations", payload, user.get("id")),
        "Narration translations generated",
    )


@router.post("/api/v1/narrations/{id}/generate-audio")
def narration_generate_audio(id: int, user: dict = Depends(require_write)):
    return ok(
        service.narration_action(id, "generate-audio", {}, user.get("id")),
        "Narration audio generated",
    )


@router.delete("/api/v1/narrations/{id}")
def delete_narration(id: int, _: dict = Depends(require_write)):
    service.delete_resource("narrations", id)
    return ok("Narration draft deleted")


def file_from_relative(
    relative_path: str | None, media_type: str | None = None
) -> FileResponse:
    if not relative_path:
        raise HTTPException(status_code=404, detail="File not found")
    root = Path(settings.media_root).resolve()
    path = (root / relative_path.strip().replace("\\", "/").lstrip("/")).resolve()
    if root not in path.parents or not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/api/v1/cms/media/images/{mediaFileId}/stream")
def cms_stream_image(mediaFileId: int):
    media = service.get_resource("media", mediaFileId, include_deleted=True)
    return file_from_relative(media.get("RelativePath"), media.get("ContentType"))


@router.get("/api/v1/cms/audio-preview/by-poi/{poiId}")
def cms_audio_preview_by_poi(poiId: int):
    return ok(service.by_column("audio", "POIId", poiId, include_deleted=True))


@router.get("/api/v1/cms/audio-preview/{audioTrackId}/stream")
def cms_stream_audio(audioTrackId: int):
    audio = service.get_resource("audio", audioTrackId, include_deleted=True)
    return file_from_relative(
        audio.get("FileUrl"), audio.get("MimeType") or "audio/mpeg"
    )


@router.get("/api/v1/poi-translations/provider")
def translation_provider():
    return ok({"provider": "manual", "available": False})


@router.get("/api/v1/poi-translations/{id}")
def get_poi_translation(id: int):
    return ok(service.get_resource("poi-translations", id))


@router.get("/api/v1/poi-translations/by-poi/{poiId}")
def poi_translations_by_poi(poiId: int):
    return ok(service.by_column("poi-translations", "POIId", poiId))


@router.post("/api/v1/poi-translations")
def create_poi_translation(payload: dict = Body(...), _: dict = Depends(require_write)):
    return ok(service.create_resource("poi-translations", payload))


@router.put("/api/v1/poi-translations/{id}")
def update_poi_translation(
    id: int, payload: dict = Body(...), _: dict = Depends(require_write)
):
    return ok(service.update_resource("poi-translations", id, payload))


@router.delete("/api/v1/poi-translations/{id}")
def delete_poi_translation(id: int, _: dict = Depends(require_write)):
    service.delete_resource("poi-translations", id)
    return ok("Deletion submitted for review")


@router.get("/api/v1/cms/submissions")
def submissions(
    status: str | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
):
    return ok(service._repository.submissions(status, page, pageSize))


@router.get("/api/v1/cms/submissions/{id}")
def submission_detail(id: int):
    return ok(service.get_submission(id))


@router.post("/api/v1/cms/submissions/{id}/approve")
def approve_submission(id: int, tasks: BackgroundTasks, reviewer: dict = Depends(require_admin)):
    result = service.review(id, "approve")
    return ok(result)


@router.post("/api/v1/cms/submissions/{id}/reject")
def reject_submission(
    id: int, payload: dict = Body(...), _: dict = Depends(require_admin)
):
    return ok(service.review(id, "reject", payload.get("reason")))


@router.post("/api/v1/cms/{resource}/{id}/resubmit")
def resubmit(resource: str, id: int, _: dict = Depends(require_write)):
    return ok(service.submit_again(resource, id))


@router.get("/api/v1/cms/submissions/{id}/preview")
def submission_preview(id: int):
    item = service.get_submission(id)
    row = service._get(item["Resource"], item["EntityId"])
    import json

    proposed = {**row, **json.loads(item["PayloadJson"])}
    if item["Resource"] == "media":
        return file_from_relative(
            proposed.get("RelativePath"), proposed.get("ContentType")
        )
    if item["Resource"] == "audio":
        return file_from_relative(
            proposed.get("FileUrl"), proposed.get("MimeType") or "audio/mpeg"
        )
    raise HTTPException(422, "This submission has no media file")


@router.get("/api/v1/cms/grants/{resource}/{id}")
def list_grants(resource: str, id: int, _: dict = Depends(require_admin)):
    if resource not in {"pois", "tours"}:
        raise HTTPException(422, "Only POI/tour scopes supported")
    service.get_resource(resource, id)
    return ok(
        service._repository.fetchall(
            "SELECT * FROM EntityGrants WHERE Resource=%s AND EntityId=%s",
            (resource, id),
        )
    )


@router.put("/api/v1/cms/grants/{resource}/{id}/{userId}")
def grant_scope(
    resource: str, id: int, userId: int, value: dict = Depends(require_admin)
):
    if resource not in {"pois", "tours"}:
        raise HTTPException(422, "Only POI/tour scopes supported")
    service.get_resource(resource, id)
    target = service._repository.fetchone(
        "SELECT u.Id FROM Users u INNER JOIN Roles r ON r.Id=u.RoleId WHERE u.Id=%s AND u.IsActive=1 AND r.Name IN ('Vendor','ContentAdmin','TourOperator')",
        (userId,),
    )
    if not target:
        raise HTTPException(422, "An active content manager is required")
    service._repository.execute(
        "IF NOT EXISTS (SELECT 1 FROM EntityGrants WITH (UPDLOCK,HOLDLOCK) WHERE Resource=%s AND EntityId=%s AND UserId=%s) INSERT EntityGrants(Resource,EntityId,UserId,GrantedByUserId) VALUES (%s,%s,%s,%s)",
        (resource, id, userId, resource, id, userId, value["id"]),
    )
    return ok("Scope granted")


@router.delete("/api/v1/cms/grants/{resource}/{id}/{userId}")
def revoke_scope(resource: str, id: int, userId: int, _: dict = Depends(require_admin)):
    if resource not in {"pois", "tours"}:
        raise HTTPException(422, "Only POI/tour scopes supported")
    service.get_resource(resource, id)
    service._repository.execute(
        "DELETE FROM EntityGrants WHERE Resource=%s AND EntityId=%s AND UserId=%s",
        (resource, id, userId),
    )
    return ok("Scope revoked")
