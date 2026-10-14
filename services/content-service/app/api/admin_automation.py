"""Real provider adapters. Approved input only; generated output stays Pending."""
import json
import hashlib
import os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.admin import ok, require_admin, scoped_user, service
from app.core.access import actor, admin
from app.core.config import settings

router = APIRouter(prefix="/api/v1/cms/automation", tags=["automation"], dependencies=[Depends(scoped_user), Depends(require_admin)])
SOURCES = {"pois", "narrations", "poi-translations"}


def configuration():
    return {"translationConfigured": bool(os.getenv("ADMIN_TRANSLATION_URL")), "ttsConfigured": bool(os.getenv("ADMIN_TTS_URL")), "automatic": os.getenv("ADMIN_AUTOMATION_ENABLED", "false").lower() == "true"}


@router.get("/status")
def status():
    jobs = service._repository.fetchall("SELECT TOP 50 Id,RecordId,Action,NewValues,CreatedAt FROM AuditLogs WHERE TableName='AdminAutomation' ORDER BY Id DESC")
    return ok({**configuration(), "jobs": [{**j, "details": json.loads(j["NewValues"] or "{}")} for j in jobs]})


class GenerateRequest(BaseModel):
    languages: list[str] = Field(default_factory=list, max_length=20)
    generateAudio: bool = True


def run(resource, entity_id, languages, generate_audio, repository=None):
    admin()
    repo = repository or service._repository
    if resource not in SOURCES:
        raise HTTPException(422, "Chỉ tạo nội dung từ văn bản POI/thuyết minh/bản dịch đã duyệt")
    source = service._get(resource, entity_id, repo)
    if source.get("ReviewStatus") != "Approved" or source.get("DeletedAt") or source.get("IsDeleted"):
        raise HTTPException(409, "Văn bản nguồn chưa được duyệt hoặc đã bị xóa")
    text = source.get("TextContent") if resource == "narrations" else source.get("Description")
    if not text or not text.strip():
        raise HTTPException(422, "Văn bản nguồn đang trống")
    version = source["Version"]
    lang = source.get("LanguageCode") or "vi"
    poi_id = source["Id"] if resource == "pois" else source.get("PoiId") or source.get("POIId")
    poi = service._get("pois", poi_id, repo)
    title = source.get("Name") or source.get("Title") or poi["Name"]
    target_languages = sorted(set(languages) - {lang})
    enabled = {r["Code"] for r in repo.fetchall("SELECT Code FROM Languages WHERE IsActive=1")}
    if any(l not in enabled for l in target_languages):
        raise HTTPException(422, "Ngôn ngữ đích chưa được bật")
    config = configuration()
    if (target_languages and not config["translationConfigured"]) or (generate_audio and not config["ttsConfigured"]):
        raise HTTPException(503, "Chưa cấu hình nhà cung cấp dịch/TTS thật trên Backend")
    if not target_languages and not generate_audio:
        raise HTTPException(422, "Chọn ngôn ngữ đích hoặc tạo audio")
    source_key = f"{resource}:{entity_id}:v{version}:" + ",".join(target_languages) + (":audio" if generate_audio else "")
    job_key = hashlib.sha256(source_key.encode()).hexdigest()[:20]  # AuditLogs.RecordId nvarchar(20)
    uid = admin()["id"]
    job_context = {"source": source_key, "title": title, "languageCode": lang, "resource": resource, "entityId": entity_id, "sourceVersion": version}
    # Reserve durable work with a SQL application lock. Failures remain visible/retryable.
    with repo.transaction() as tx:
        locked = tx.lock(resource, entity_id)
        if locked["Version"] != version:
            raise HTTPException(409, "Phiên bản nguồn đã thay đổi")
        lock_result = tx.scalar("DECLARE @result int; EXEC @result=sp_getapplock @Resource=%s,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @result AS result", ("AdminAutomation:" + job_key,))
        if lock_result is None or lock_result < 0:
            raise HTTPException(409, "Đang có tác vụ khác xử lý phiên bản này")
        latest = tx.fetchone("SELECT TOP 1 Action FROM AuditLogs WHERE TableName='AdminAutomation' AND RecordId=%s ORDER BY Id DESC", (job_key,))
        if latest and latest["Action"] in {"Started", "Completed"}:
            raise HTTPException(409, "Phiên bản này đang xử lý hoặc đã tạo nội dung; không tạo trùng")
        tx.execute("INSERT INTO AuditLogs(UserId,TableName,RecordId,Action,NewValues) VALUES (%s,'AdminAutomation',%s,'Started',%s)", (uid, job_key, json.dumps(job_context, ensure_ascii=False)))
    created_files = []
    try:
        headers = {"Authorization": "Bearer " + os.getenv("ADMIN_PROVIDER_TOKEN", "")} if os.getenv("ADMIN_PROVIDER_TOKEN") else {}
        translations = []
        audio_bytes = None
        with httpx.Client(timeout=90, follow_redirects=False) as client:
            for target in target_languages:
                response = client.post(os.environ["ADMIN_TRANSLATION_URL"], headers=headers, json={"text": text, "name": title, "sourceLanguage": lang, "targetLanguage": target})
                response.raise_for_status()
                result = response.json()
                if not isinstance(result.get("text"), str) or not result["text"].strip() or not isinstance(result.get("name"), str) or not result["name"].strip():
                    raise ValueError("Provider returned invalid translation")
                translations.append({"LanguageCode": target, "Description": result["text"], "Name": result["name"]})
            if generate_audio:
                response = client.post(os.environ["ADMIN_TTS_URL"], headers=headers, json={"text": text, "languageCode": lang, "voice": source.get("Voice")})
                response.raise_for_status()
                mime = response.headers.get("content-type", "").split(";")[0]
                extensions = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg"}
                if mime not in extensions or not response.content or len(response.content) > 50 * 1024 * 1024:
                    raise ValueError("Provider returned invalid audio")
                audio_bytes = response.content
        with repo.transaction() as tx:
            current = tx.lock(resource, entity_id)
            if current["Version"] != version or current["ReviewStatus"] != "Approved" or current.get("DeletedAt") or current.get("IsDeleted"):
                raise HTTPException(409, "Nguồn đã thay đổi trong khi xử lý; chưa xuất bản kết quả")
            generated = []
            for translation in translations:
                existing = tx.fetchone("SELECT * FROM POITranslations WITH(UPDLOCK,HOLDLOCK) WHERE POIId=%s AND LanguageCode=%s", (poi_id, translation["LanguageCode"]))
                if existing:
                    if existing.get("IsDeleted"):
                        raise HTTPException(409, "Bản dịch đích đã xóa; cần phục hồi trước")
                    latest = tx.latest("poi-translations", existing["Id"])
                    if latest and latest["Status"] == "Pending":
                        raise HTTPException(409, "Bản dịch đích đã có đề xuất chờ duyệt; giữ nguyên đề xuất")
                    row = existing
                    payload = translation
                else:
                    row = tx.create_row("poi-translations", {**translation, "POIId": poi_id, "ReviewStatus": "Pending"})
                    payload = {}
                submission = tx.submit("poi-translations", row, payload, uid)
                generated.append({"resource": "poi-translations", "entityId": row["Id"], "submissionId": submission["Id"]})
            if audio_bytes:
                file_name = uuid.uuid4().hex + extensions[mime]
                relative = "uploads/audio/" + file_name
                target = (Path(settings.media_root) / relative).resolve()
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(audio_bytes)
                created_files.append(target)
                media = tx.save_media_file(file_name, file_name, mime, len(audio_bytes), relative, uid, poi_id, None, "Pending")
                tx.submit("media", media, {}, uid)
                audio = tx.create_row("audio", {"POIId": poi_id, "LanguageCode": lang, "Title": title, "AudioType": "prerecorded", "FileUrl": relative, "MimeType": mime, "FileSizeBytes": len(audio_bytes), "IsActive": True, "ReviewStatus": "Pending"})
                submission = tx.submit("audio", audio, {}, uid)
                generated.append({"resource": "audio", "entityId": audio["Id"], "submissionId": submission["Id"]})
            tx.execute("INSERT INTO AuditLogs(UserId,TableName,RecordId,Action,NewValues) VALUES (%s,'AdminAutomation',%s,'Completed',%s)", (uid, job_key, json.dumps({**job_context, "generated": generated}, ensure_ascii=False)))
        return {"status": "Completed", "generated": generated}
    except Exception as exc:
        for file in created_files:
            file.unlink(missing_ok=True)
        repo.execute("INSERT INTO AuditLogs(UserId,TableName,RecordId,Action,NewValues) VALUES (%s,'AdminAutomation',%s,'Failed',%s)", (uid, job_key, json.dumps({**job_context, "message": "Không tạo được nội dung. Kiểm tra nhà cung cấp hoặc phiên bản nguồn."}, ensure_ascii=False)))
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(502, "Nhà cung cấp dịch/TTS không trả kết quả hợp lệ; chưa tạo nội dung") from exc


@router.post("/{resource}/{entity_id}")
def generate(resource: str, entity_id: int, payload: GenerateRequest):
    return ok(run(resource, entity_id, payload.languages, payload.generateAudio))


def after_approval(submission, reviewer):
    """Background task errors never undo an already committed approval."""
    config = configuration()
    if not config["automatic"] or submission["Operation"] == "delete" or submission["Resource"] not in SOURCES:
        return
    resource = submission["Resource"]
    languages = [r["Code"] for r in service._repository.fetchall("SELECT Code FROM Languages WHERE IsActive=1")] if config["translationConfigured"] and resource in {"pois", "narrations"} else []
    if not languages and not config["ttsConfigured"]:
        return
    token = actor.set(reviewer)
    try:
        run(resource, submission["EntityId"], languages, config["ttsConfigured"])
    except HTTPException:
        pass  # Failed provider attempts are recorded; approval remains successful.
    finally:
        actor.reset(token)
