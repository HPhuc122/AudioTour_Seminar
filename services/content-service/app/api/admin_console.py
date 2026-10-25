"""Additive CMS endpoints backed by audited SQL schema; no public API changes."""
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from app.api.admin import ok, require_admin, scoped_user, service
from app.core.access import admin, scope
from app.core.config import settings
from app.services.review_service import REVIEWED

router = APIRouter(prefix="/api/v1/cms", tags=["admin-console"], dependencies=[Depends(scoped_user)])
SEARCH = {
    "pois": ["Code", "Name", "Category"], "tours": ["Code"],
    "audio": ["Title", "LanguageCode"], "media": ["OriginalFileName"],
    "narrations": ["Title", "TextContent"], "poi-translations": ["Name", "LanguageCode"],
    "tour-translations": ["Name", "LanguageCode"], "qr": ["Code", "Name"],
    "languages": ["Code", "Name", "NativeName"],
}


def like(value):
    return "%" + value.replace("[", "[[]").replace("%", "[%]").replace("_", "[_]") + "%"


def paged(sql, params, page, size):
    repo = service._repository
    total = repo.scalar("SELECT COUNT(*) AS total FROM (" + sql + ") counted", params) or 0
    rows = repo.fetchall(sql + " ORDER BY Id DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY", params + ((page - 1) * size, size))
    return {"items": rows, "total": total, "page": page, "pageSize": size}


@router.get("/catalog/{resource}")
def catalog(resource: str, search: str = Query("", max_length=200), status: str = "", active: Literal["", "true", "false"] = "", fileType: Literal["", "image", "audio"] = "", poiId: int | None = Query(None, gt=0), page: int = Query(1, ge=1), pageSize: int = Query(25, ge=1, le=100)):
    repo = service._repository
    if resource == "users":
        admin()
        sql = "SELECT u.Id, u.Username AS username, u.Email AS email, u.RoleId AS roleId, r.Name AS role, u.IsActive AS isActive, u.PreferredLanguage AS preferredLanguage, u.CreatedAt FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE 1=1"
        params = []
        if search.strip():
            sql += " AND (u.Username LIKE %s OR u.Email LIKE %s)"
            params += [like(search.strip())] * 2
        if status:
            sql += " AND r.Name=%s"
            params.append(status)
        if active:
            sql += " AND u.IsActive=%s"
            params.append(active == "true")
        return ok(paged(sql, tuple(params), page, pageSize))
    if resource not in SEARCH:
        raise HTTPException(404, "Loại nội dung không hỗ trợ")
    if resource == "languages":
        admin()
    cfg = repo._cfg(resource)
    clause, params = scope(resource) if resource != "languages" else ("1=1", ())
    table = cfg["table"]
    where = ["(" + clause + ")"]
    values = list(params)
    soft = cfg.get("soft_delete")
    if soft:
        where.append("DeletedAt IS NULL" if soft is True else "IsDeleted=0")
    if resource in REVIEWED:
        effective = "COALESCE((SELECT TOP 1 s.Status FROM ContentSubmissions s WHERE s.Resource=%s AND s.EntityId=" + table + ".Id ORDER BY s.Id DESC), ReviewStatus)"
        if status:
            if status not in {"Pending", "Approved", "Rejected", "Superseded"}:
                raise HTTPException(422, "Trạng thái không hợp lệ")
            where.append(effective + "=%s")
            values += [resource, status]
    if poiId is not None:
        key = "PoiId" if resource in {"media", "narrations", "qr"} else "POIId"
        if key not in cfg["fields"]:
            raise HTTPException(422, "Nội dung không thuộc POI")
        service._get("pois", poiId)
        where.append(key + "=%s")
        values.append(poiId)
    if active and "IsActive" in cfg["fields"]:
        where.append("IsActive=%s")
        values.append(active == "true")
    if fileType:
        if resource != 'media':
            raise HTTPException(422, "Bộ lọc loại file chỉ áp dụng cho media")
        where.append('FileType=%s')
        values.append(fileType)
    if search.strip():
        search_clauses = [c + " LIKE %s" for c in SEARCH[resource]]
        values += [like(search.strip())] * len(search_clauses)
        # Include text from the latest proposal without changing the canonical row.
        if resource in REVIEWED:
            search_clauses.append("EXISTS (SELECT 1 FROM ContentSubmissions s WHERE s.Id=(SELECT MAX(latest.Id) FROM ContentSubmissions latest WHERE latest.Resource=%s AND latest.EntityId=" + table + ".Id) AND s.PayloadJson LIKE %s)")
            values += [resource, like(search.strip())]
        where.append("(" + " OR ".join(search_clauses) + ")")
    sql = "SELECT * FROM " + table + " WHERE " + " AND ".join(where)
    if resource == "languages":
        total = repo.scalar("SELECT COUNT(*) AS total FROM (" + sql + ") counted", tuple(values)) or 0
        rows = repo.fetchall(sql + " ORDER BY SortOrder,Code OFFSET %s ROWS FETCH NEXT %s ROWS ONLY", tuple(values) + ((page - 1) * pageSize, pageSize))
        return ok({"items": rows, "total": total, "page": page, "pageSize": pageSize})
    result = paged(sql, tuple(values), page, pageSize)
    if resource in REVIEWED:
        result["items"] = [repo.overlay(resource, r) for r in result["items"]]
    return ok(result)


@router.get("/review-queue")
def review_queue(status: Literal["Pending", "Approved", "Rejected", "Superseded"] = "Pending", resource: str = "", search: str = Query("", max_length=200), page: int = Query(1, ge=1), pageSize: int = Query(25, ge=1, le=100)):
    if resource and resource not in REVIEWED:
        raise HTTPException(422, "Loại hồ sơ không hợp lệ")
    visible, params = [], [status]
    for kind in sorted(REVIEWED):
        cfg = service._repository._cfg(kind)
        clause, values = scope(kind)
        visible.append("(s.Resource='" + kind + "' AND EXISTS (SELECT 1 FROM " + cfg["table"] + " WHERE Id=s.EntityId AND (" + clause + ")))")
        params.extend(values)
    sql = "SELECT s.*,u.Username AS SubmittedBy FROM ContentSubmissions s LEFT JOIN Users u ON u.Id=s.SubmittedByUserId WHERE s.Status=%s AND (" + " OR ".join(visible) + ")"
    if resource:
        sql += " AND s.Resource=%s"
        params.append(resource)
    if search.strip():
        searchable = ["s.PayloadJson LIKE %s", "u.Username LIKE %s", "CAST(s.EntityId AS nvarchar(30)) LIKE %s"]
        params += [like(search.strip())] * 3
        for kind in sorted(REVIEWED):
            cfg = service._repository._cfg(kind)
            columns = SEARCH[kind]
            searchable.append("(s.Resource='" + kind + "' AND EXISTS(SELECT 1 FROM " + cfg['table'] + " item WHERE item.Id=s.EntityId AND (" + " OR ".join('item.' + c + ' LIKE %s' for c in columns) + ")))")
            params += [like(search.strip())] * len(columns)
        sql += " AND (" + " OR ".join(searchable) + ")"
    return ok(paged(sql, tuple(params), page, pageSize))


@router.get("/review-dossier/{submission_id}")
def review_dossier(submission_id: int):
    submission = service.get_submission(submission_id)
    row = service._get(submission["Resource"], submission["EntityId"])
    proposed = {**row, **json.loads(submission["PayloadJson"])}
    submitter = service._repository.fetchone("SELECT Username,Email FROM Users WHERE Id=%s", (submission["SubmittedByUserId"],))
    return ok({"submission": submission, "canonical": row, "proposed": proposed, "submitter": submitter})


@router.get("/console-summary")
def console_summary():
    repo = service._repository
    pending = repo.submissions("Pending", 1, 1)["total"]
    counts = {}
    for kind in ("pois", "tours", "audio", "media"):
        counts[kind] = service.list_resource(kind, page_size=1)["total"]
    clause, params = scope("media")
    media = repo.fetchall("SELECT RelativePath FROM MediaFiles WHERE IsDeleted=0 AND (" + clause + ")", params)
    root = Path(settings.media_root).resolve()
    missing = 0
    for item in media:
        target = (root / str(item["RelativePath"]).replace("\\", "/")).resolve()
        missing += int(root not in target.parents or not target.is_file())
    clause, params = scope("pois")
    expiring = repo.scalar("SELECT COUNT(*) AS total FROM POIs WHERE DeletedAt IS NULL AND ValidUntil>=SYSUTCDATETIME() AND ValidUntil<DATEADD(day,30,SYSUTCDATETIME()) AND (" + clause + ")", params) or 0
    expired = repo.scalar("SELECT COUNT(*) AS total FROM POIs WHERE DeletedAt IS NULL AND ValidUntil<SYSUTCDATETIME() AND (" + clause + ")", params) or 0
    return ok({**counts, "pending": pending, "missingMedia": missing, "expiring": expiring, "expired": expired})


@router.get("/transactions", dependencies=[Depends(require_admin)])
def transactions(kind: Literal["poi", "access"] = "poi", status: str = "", search: str = Query("", max_length=200), page: int = Query(1, ge=1), pageSize: int = Query(25, ge=1, le=100)):
    if status and status not in {"Pending", "Paid", "Failed", "Expired"}:
        raise HTTPException(422, "Trạng thái không hợp lệ")
    if kind == "poi":
        sql = "SELECT s.*,p.Name AS TargetName,u.Username AS Account FROM PoiPaymentSessions s JOIN POIs p ON p.Id=s.PoiId JOIN Users u ON u.Id=s.VendorUserId WHERE 1=1"
    else:
        sql = "SELECT s.*,q.Name AS TargetName,q.Code AS Account FROM AccessPaymentSessions s JOIN GuestAccessPasses g ON g.Id=s.GuestAccessPassId JOIN QRLocations q ON q.Id=g.QrLocationId WHERE 1=1"
    params = []
    if status:
        sql += " AND s.Status=%s"
        params.append(status)
    if search.strip():
        sql += " AND (s.Provider LIKE %s OR CAST(s.Id AS nvarchar(30)) LIKE %s)"
        params += [like(search.strip())] * 2
    result = paged(sql, tuple(params), page, pageSize)
    for row in result["items"]:
        row["EvidenceStatus"] = "Chưa có bằng chứng đối soát"
        row["IsSimulated"] = "simulat" in row["Provider"].lower()
    return ok(result)


@router.get("/validity", dependencies=[Depends(require_admin)])
def validity(status: Literal["", "expired", "expiring", "unlimited", "valid", "scheduled"] = "", search: str = Query("", max_length=200), page: int = Query(1, ge=1), pageSize: int = Query(25, ge=1, le=100)):
    sql = "SELECT p.Id,p.Code,p.Name,p.UserId,p.ValidFrom,p.ValidUntil,p.ReviewStatus,p.PaymentRequired,u.Username AS Owner FROM POIs p LEFT JOIN Users u ON u.Id=p.UserId WHERE p.DeletedAt IS NULL"
    params = []
    if search.strip():
        sql += " AND (p.Name LIKE %s OR p.Code LIKE %s OR u.Username LIKE %s)"
        params += [like(search.strip())] * 3
    conditions = {"expired": "p.ValidUntil<SYSUTCDATETIME()", "expiring": "p.ValidUntil>=SYSUTCDATETIME() AND p.ValidUntil<DATEADD(day,30,SYSUTCDATETIME())", "unlimited": "p.ValidUntil IS NULL", "valid": "(p.ValidFrom IS NULL OR p.ValidFrom<=SYSUTCDATETIME()) AND (p.ValidUntil IS NULL OR p.ValidUntil>=SYSUTCDATETIME())", "scheduled": "p.ValidFrom>SYSUTCDATETIME()"}
    if status:
        sql += " AND " + conditions[status]
    return ok(paged(sql, tuple(params), page, pageSize))


class ValidityChange(BaseModel):
    validFrom: datetime | None
    validUntil: datetime | None

    @model_validator(mode="after")
    def ordered(self):
        for key in ("validFrom", "validUntil"):
            value = getattr(self, key)
            if value and value.tzinfo:
                setattr(self, key, value.astimezone(timezone.utc).replace(tzinfo=None))
        if self.validFrom and self.validUntil and self.validUntil <= self.validFrom:
            raise ValueError("Ngày hết hạn phải sau ngày bắt đầu")
        return self


@router.put("/validity/{poi_id}", dependencies=[Depends(require_admin)])
def update_validity(poi_id: int, change: ValidityChange):
    return ok(service.update_resource("pois", poi_id, {"ValidFrom": change.validFrom, "ValidUntil": change.validUntil}), "Đã gửi thời hạn mới vào hàng đợi duyệt")


@router.get("/vendors", dependencies=[Depends(require_admin)])
def vendors(search: str = Query("", max_length=200), page: int = Query(1, ge=1), pageSize: int = Query(25, ge=1, le=100)):
    sql = "SELECT u.Id,u.Username,u.Email,u.IsActive,u.CreatedAt,(SELECT COUNT(*) FROM POIs p WHERE p.UserId=u.Id AND p.DeletedAt IS NULL) AS PoiCount FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE r.Name='Vendor'"
    params = ()
    if search.strip():
        sql += " AND (u.Username LIKE %s OR u.Email LIKE %s)"
        params = (like(search.strip()),) * 2
    return ok(paged(sql, params, page, pageSize))


@router.get("/vendors/{user_id}", dependencies=[Depends(require_admin)])
def vendor_detail(user_id: int):
    repo = service._repository
    user = repo.fetchone("SELECT u.Id,u.Username,u.Email,u.IsActive,u.CreatedAt FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE u.Id=%s AND r.Name='Vendor'", (user_id,))
    if not user:
        raise HTTPException(404, "Không tìm thấy chủ sạp")
    return ok({"user": user, "pois": repo.fetchall("SELECT Id,Name,Code,ReviewStatus,ValidUntil FROM POIs WHERE UserId=%s AND DeletedAt IS NULL", (user_id,)), "grants": repo.fetchall("SELECT Resource,EntityId FROM EntityGrants WHERE UserId=%s", (user_id,)), "approvalSupported": False})


@router.get("/capabilities", dependencies=[Depends(require_admin)])
def capabilities():
    return ok({"vendorApproval": False, "servicePlans": False, "paymentVerification": False, "validityManagement": True, "languages": True, "ownership": "POIs.UserId / EntityGrants", "limitations": ["Hồ sơ duyệt chủ sạp cần migration đã xác nhận.", "Danh mục gói và giá chưa có schema/nghiệp vụ.", "Session Paid không chứng minh giao dịch hợp lệ; chưa có đối soát."]})


class LanguageChange(BaseModel):
    Code: str = Field(min_length=1, max_length=10, pattern=r"^[a-zA-Z0-9-]+$")
    Name: str = Field(min_length=1, max_length=100)
    NativeName: str = Field(min_length=1, max_length=100)
    IsActive: bool = True
    SortOrder: int = Field(0, ge=0)

    @model_validator(mode="after")
    def nonempty(self):
        self.Name = self.Name.strip()
        self.NativeName = self.NativeName.strip()
        if not self.Name or not self.NativeName:
            raise ValueError("Tên ngôn ngữ không được để trống")
        return self


@router.post("/languages", dependencies=[Depends(require_admin)])
def create_language(change: LanguageChange):
    if service._repository.fetchone("SELECT Code FROM Languages WHERE Code=%s", (change.Code,)):
        raise HTTPException(409, "Mã ngôn ngữ đã tồn tại")
    return ok(service._repository.create_row("languages", change.model_dump()))


@router.put("/languages/{code}", dependencies=[Depends(require_admin)])
def update_language(code: str, change: LanguageChange):
    if change.Code != code:
        raise HTTPException(422, "Không đổi mã ngôn ngữ đã tạo")
    repo = service._repository
    if not repo.fetchone("SELECT Code FROM Languages WHERE Code=%s", (code,)):
        raise HTTPException(404, "Ngôn ngữ không tồn tại")
    data = change.model_dump(exclude={"Code"})
    repo.execute("UPDATE Languages SET Name=%s,NativeName=%s,IsActive=%s,SortOrder=%s WHERE Code=%s", (data["Name"],data["NativeName"],data["IsActive"],data["SortOrder"],code))
    return ok(repo.fetchone("SELECT * FROM Languages WHERE Code=%s", (code,)))


@router.get("/statistics")
def statistics(startDate: date | None = None, endDate: date | None = None):
    if startDate and endDate and endDate < startDate:
        raise HTTPException(422, "Ngày kết thúc phải từ ngày bắt đầu trở đi")
    repo = service._repository
    clause, params = scope("pois")
    where = "n.POIId IN (SELECT Id FROM POIs WHERE " + clause + ")"
    values = list(params)
    if startDate:
        where += " AND n.PlayedAt >= %s"
        values.append(startDate.isoformat())
    if endDate:
        where += " AND n.PlayedAt < DATEADD(day,1,CAST(%s AS date))"
        values.append(endDate.isoformat())
    summary = repo.fetchone("SELECT COUNT(*) AS plays,COALESCE(SUM(CAST(n.DurationPlayedSeconds AS bigint)),0) AS durationSeconds FROM NarrationLogs n WHERE " + where, tuple(values))
    dates = repo.fetchall("SELECT CONVERT(date,n.PlayedAt) AS groupKey,COUNT(*) AS plays FROM NarrationLogs n WHERE " + where + " GROUP BY CONVERT(date,n.PlayedAt) ORDER BY groupKey", tuple(values))
    popular = repo.fetchall("SELECT TOP 10 n.POIId AS poiId,p.Name AS groupKey,COUNT(*) AS plays FROM NarrationLogs n JOIN POIs p ON p.Id=n.POIId WHERE " + where + " GROUP BY n.POIId,p.Name ORDER BY plays DESC,n.POIId", tuple(values))
    return ok({"summary": summary, "dates": dates, "popular": popular, "timeZone": "UTC"})
