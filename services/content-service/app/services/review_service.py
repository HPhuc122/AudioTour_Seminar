import json
import math
from pathlib import Path
from datetime import datetime

from fastapi import HTTPException
from app.core.admin_validation import validate_content

from app.core.access import ADMIN_ROLES, admin, scope, user, writable
from app.core.config import settings
from app.repositories.review_repository import ReviewRepository
from app.services.admin_service import AdminService

REVIEWED = {
    "pois",
    "tours",
    "audio",
    "media",
    "narrations",
    "poi-translations",
    "tour-translations",
}
CONTROLLED = {
    "PaymentStatus",
    "Id",
    "Version",
    "ReviewStatus",
    "ApprovalStatus",
    "Status",
    "RejectionReason",
    "SubmittedByUserId",
    "SubmittedAt",
    "ReviewedAt",
    "ReviewedByUserId",
    "UploadedByUserId",
    "IsDeleted",
    "CreatedAt",
    "UpdatedAt",
    "GeneratedAudioTrackId",
    "SimulatedAudioUrl",
    "PublishedTranslationId",
    "PublishedTranslationVersion",
}


class ReviewService(AdminService):
    """Scope every CMS read; publish proposals only in an atomic admin review."""

    def __init__(self, repository=None):
        super().__init__(repository or ReviewRepository())

    def _get(self, resource, item_id, repository=None):
        row = (repository or self._repository).get_row(
            resource, item_id, include_deleted=True
        )
        if not row:
            raise HTTPException(404, "Content not found or outside assigned scope")
        return row

    def _allowed_payload(self, resource, payload, current=None):
        validate_content(resource, payload, current)
        cfg = self._repository._cfg(resource)
        normalized = self._repository._clean(cfg, payload, False)
        prohibited = CONTROLLED | (
            {
                "UserId",
                "LifecycleStatus",
                "PaymentStatus",
                "PaymentRequired",
                "ValidFrom",
                "ValidUntil",
            }
            if user()["role"] not in ADMIN_ROLES
            else set()
        )
        if resource == "media":
            prohibited |= {
                "RelativePath",
                "FileName",
                "FileType",
                "ContentType",
                "FileSize",
            }
        if prohibited.intersection(normalized):
            raise HTTPException(
                403, "Ownership, publication and review metadata are server-controlled"
            )
        data = dict(normalized)
        validate_content(resource, data, current)
        if resource == "audio" and data.get("AudioType") == "file":
            data["AudioType"] = (
                "prerecorded"  # Accept legacy Web input, preserve SQL/Mobile type.
            )
        for key, parent in [("POIId", "pois"), ("PoiId", "pois"), ("TourId", "tours")]:
            if key in data and data[key] is not None:
                self._get(parent, int(data[key]))
                if current and data[key] != current.get(key):
                    raise HTTPException(
                        422, "Parent cannot be changed; create new content instead"
                    )
        if resource == "qr":
            target = {**(current or {}), **data}
            if bool(target.get("PoiId")) == bool(target.get("TourId")):
                raise HTTPException(422, "Choose exactly one POI or tour")
        merged = {**(current or {}), **data}
        if resource == "pois":
            for key, low, high in [
                ("Latitude", -90, 90),
                ("Longitude", -180, 180),
                ("RadiusMeters", 1, 10000),
            ]:
                value = merged.get(key)
                try:
                    valid = (
                        value is not None
                        and math.isfinite(float(value))
                        and low <= float(value) <= high
                    )
                except (TypeError, ValueError):
                    valid = False
                if not valid:
                    raise HTTPException(422, f"Invalid {key}")
        if resource == "audio":
            if merged.get("AudioType") not in {"prerecorded", "tts"}:
                raise HTTPException(422, "AudioType must be prerecorded or tts")
            if not merged.get("FileUrl") and not merged.get("TTSText"):
                raise HTTPException(422, "Audio file or TTS text required")
            if merged.get("FileUrl"):
                path = self._path(merged["FileUrl"])
                clause, params = scope("media")
                media = self._repository.fetchone(
                    f"SELECT * FROM MediaFiles WHERE RelativePath=%s AND FileType='audio' AND IsDeleted=0 AND ({clause})",
                    (merged["FileUrl"],) + params,
                )
                if not media or not path.is_file():
                    raise HTTPException(
                        422, "Upload an audio file inside your assigned POI first"
                    )
                if media.get("PoiId") != merged.get("POIId"):
                    raise HTTPException(422, "Audio media must belong to the same POI")
        if resource == "media":
            if "RelativePath" in data:
                self._path(data["RelativePath"])
        return data

    @staticmethod
    def _path(relative):
        root = Path(settings.media_root).resolve()
        path = (root / str(relative).replace("\\", "/")).resolve()
        if root not in path.parents:
            raise HTTPException(422, "Media must be inside MEDIA_ROOT")
        return path

    def list_resource(
        self, resource, include_deleted=False, filters=None, page=1, page_size=100
    ):
        result = super().list_resource(
            resource, include_deleted, filters, page, page_size
        )
        if resource in REVIEWED:
            result["items"] = [
                self._repository.overlay(resource, r) for r in result["items"]
            ]
        return result

    def get_resource(self, resource, item_id, include_deleted=False):
        row = self._get(resource, item_id)
        return self._repository.overlay(resource, row) if resource in REVIEWED else row

    def by_column(self, resource, column, value, include_deleted=False):
        if resource in {
            "audio",
            "media",
            "narrations",
            "poi-translations",
        } and column in {"POIId", "PoiId"}:
            self._get("pois", value)
        if resource == "tour-translations":
            self._get("tours", value)
        rows = super().by_column(resource, column, value, include_deleted)
        return (
            [self._repository.overlay(resource, r) for r in rows]
            if resource in REVIEWED
            else rows
        )

    def create_resource(self, resource, payload):
        uid = writable()["id"]
        if resource not in REVIEWED | {"qr"}:
            admin()
            return super().create_resource(resource, payload)
        data = self._allowed_payload(resource, payload)
        required = {
            "pois": ("Code", "Name", "Latitude", "Longitude"),
            "tours": ("Code", "DefaultLanguage"),
            "audio": ("POIId", "LanguageCode", "AudioType"),
            "narrations": ("PoiId", "Title", "LanguageCode", "TextContent"),
            "poi-translations": ("POIId", "LanguageCode", "Name"),
            "tour-translations": ("TourId", "LanguageCode", "Name"),
            "qr": ("Code",),
        }.get(resource, ())
        if any(data.get(key) is None or data.get(key) == "" for key in required):
            raise HTTPException(422, "Missing required content fields")
        if resource in {"pois", "tours"}:
            data.setdefault("UserId", uid)
        if resource in {"audio", "media", "narrations", "poi-translations"} and not (
            data.get("POIId") or data.get("PoiId")
        ):
            raise HTTPException(422, "POI is required")
        if resource == "tour-translations" and not data.get("TourId"):
            raise HTTPException(422, "Tour is required")
        if resource == "pois":
            data.update(ApprovalStatus=0)
            data.setdefault("LifecycleStatus", 1)
        if resource == "narrations":
            data.update(
                Status="Pending", SubmittedByUserId=uid, SubmittedAt=datetime.utcnow()
            )
            data.setdefault("Voice", "vi-VN")
        if resource in REVIEWED:
            data["ReviewStatus"] = "Pending"
        with self._repository.transaction() as repo:
            row = repo.create_row(resource, data)
            if resource in REVIEWED:
                repo.submit(resource, row, {}, uid)
                return repo.overlay(resource, row)
            return row

    def update_resource(self, resource, item_id, payload):
        uid = writable()["id"]
        row = self._get(resource, item_id)
        data = self._allowed_payload(resource, payload, row)
        if resource not in REVIEWED:
            if resource != "qr":
                admin()
            return self._repository.update_row(resource, item_id, data)
        with self._repository.transaction() as repo:
            row = repo.lock(resource, item_id)
            if not row:
                raise HTTPException(404, "Content not found")
            latest = repo.latest(resource, item_id)
            previous = (
                json.loads(latest["PayloadJson"])
                if latest
                and latest["Status"] in {"Pending", "Rejected"}
                and latest["Operation"] == "update"
                else {}
            )
            repo.submit(resource, row, {**previous, **data}, uid)
            return repo.overlay(resource, row)

    def delete_resource(self, resource, item_id):
        uid = writable()["id"]
        self._get(resource, item_id)
        if resource not in REVIEWED:
            if resource != "qr":
                admin()
            return self._repository.delete_row(resource, item_id)
        with self._repository.transaction() as repo:
            row = repo.lock(resource, item_id)
            repo.submit(resource, row, {}, uid, "delete")

    def restore_resource(self, resource, item_id):
        admin()
        self._get(resource, item_id)
        with self._repository.transaction() as repo:
            repo.restore_row(resource, item_id)
            if resource in REVIEWED:
                row = repo.lock(resource, item_id)
                repo.update_row(
                    resource,
                    item_id,
                    {"ReviewStatus": "Pending", "Version": row.get("Version", 1) + 1},
                )
                repo.submit(
                    resource, repo.get_row(resource, item_id, True), {}, user()["id"]
                )

    def submit_again(self, resource, item_id):
        if resource not in REVIEWED:
            raise HTTPException(422, "Resource is not reviewable")
        writable()
        self._get(resource, item_id)
        with self._repository.transaction() as repo:
            row = repo.lock(resource, item_id)
            latest = repo.latest(resource, item_id)
            if latest and latest["Status"] == "Pending":
                raise HTTPException(409, "Already pending")
            if latest and latest["Status"] == "Approved":
                raise HTTPException(409, "Edit content to create a new proposal")
            repo.submit(
                resource,
                row,
                json.loads(latest["PayloadJson"]) if latest else {},
                user()["id"],
                latest["Operation"] if latest else "update",
            )
            return repo.overlay(resource, row)

    def get_submission(self, submission_id, repository=None):
        repo = repository or self._repository
        row = repo.fetchone(
            "SELECT * FROM ContentSubmissions WHERE Id=%s", (submission_id,)
        )
        if not row:
            raise HTTPException(404, "Submission not found")
        self._get(row["Resource"], row["EntityId"], repo)
        return row

    def review(self, submission_id, action, reason=None):
        reviewer = admin()["id"]
        if action not in {"approve", "reject"}:
            raise HTTPException(422, "Unknown review action")
        if reason is not None and not isinstance(reason, str):
            raise HTTPException(422, "Rejection reason must be text")
        reason = (reason or "").strip()
        if action == "reject" and (not reason or len(reason) > 1000):
            raise HTTPException(422, "Rejection reason (1-1000 characters) required")
        with self._repository.transaction() as repo:
            initial = self.get_submission(submission_id, repo)
            row = repo.lock(initial["Resource"], initial["EntityId"])
            submission = repo.fetchone(
                "SELECT * FROM ContentSubmissions WITH (UPDLOCK,HOLDLOCK) WHERE Id=%s",
                (submission_id,),
            )
            if submission["Status"] != "Pending":
                raise HTTPException(409, "Submission is no longer pending")
            if row.get("Version", 1) != submission["BaseVersion"]:
                raise HTTPException(409, "Public version changed; resubmit")
            resource = submission["Resource"]
            payload = json.loads(submission["PayloadJson"])
            if action == "approve":
                if row.get("DeletedAt") or row.get("IsDeleted"):
                    raise HTTPException(409, "Restore deleted content before approving")
                if (
                    submission["Operation"] != "delete"
                    and resource == "audio"
                    and (payload.get("FileUrl") or row.get("FileUrl"))
                ):
                    relative = payload.get("FileUrl") or row["FileUrl"]
                    media = repo.fetchone(
                        "SELECT * FROM MediaFiles WHERE RelativePath=%s AND PoiId=%s AND FileType='audio' AND ReviewStatus='Approved' AND ApprovalStatus='Approved' AND IsDeleted=0",
                        (relative, payload.get("POIId") or row["POIId"]),
                    )
                    if not media or not self._path(relative).is_file():
                        raise HTTPException(
                            409,
                            "Approve the uploaded audio media first; file must exist",
                        )
                if (
                    submission["Operation"] != "delete"
                    and resource == "media"
                    and not self._path(
                        payload.get("RelativePath") or row.get("RelativePath")
                    ).is_file()
                ):
                    raise HTTPException(409, "Media file does not exist in MEDIA_ROOT")
                repo.archive(resource, row, reviewer)
                if submission["Operation"] == "delete":
                    if resource == "narrations" and row.get("PublishedTranslationId"):
                        published = repo.lock(
                            "poi-translations", row["PublishedTranslationId"]
                        )
                        if published and published["Version"] == row.get(
                            "PublishedTranslationVersion"
                        ):
                            repo.archive("poi-translations", published, reviewer)
                            repo.execute(
                                "UPDATE POITranslations SET IsDeleted=1, ReviewStatus='Rejected', Version=Version+1, UpdatedAt=SYSUTCDATETIME() WHERE Id=%s",
                                (published["Id"],),
                            )
                    repo.delete_row(resource, row["Id"])
                    repo.update_row(
                        resource,
                        row["Id"],
                        {
                            "ReviewStatus": "Rejected",
                            "Version": row.get("Version", 1) + 1,
                        },
                    )
                else:
                    clean = {
                        k: v
                        for k, v in payload.items()
                        if k not in CONTROLLED and not k.startswith("_")
                    }
                    clean.update(
                        ReviewStatus="Approved",
                        Version=row.get("Version", 1) + 1,
                        RejectionReason=None,
                    )
                    if resource == "pois":
                        clean["ApprovalStatus"] = 1
                        # Approval does not bypass an outstanding payment requirement.
                        target = {**row, **clean}
                        clean["LifecycleStatus"] = (
                            2
                            if target.get("PaymentRequired")
                            and target.get("PaymentStatus") not in {2, 3}
                            else 3
                        )
                    if resource == "media":
                        clean.update(
                            ApprovalStatus="Approved",
                            ReviewedByUserId=reviewer,
                            ReviewedAt=datetime.utcnow(),
                        )
                    if resource == "narrations":
                        clean.update(
                            Status="Approved",
                            ReviewedByUserId=reviewer,
                            ReviewedAt=datetime.utcnow(),
                        )
                    repo.update_row(resource, row["Id"], clean)
                    if resource == "tours" and "_pois" in payload:
                        for item in payload["_pois"]:
                            self._get("pois", item["poiId"], repo)
                        repo.execute(
                            "DELETE FROM TourPOIs WHERE TourId=%s", (row["Id"],)
                        )
                        for index, item in enumerate(payload["_pois"]):
                            repo.add_tour_poi(
                                row["Id"], {"poiId": item["poiId"], "orderIndex": index}
                            )
                    if resource == "narrations":
                        final = repo.get_row(resource, row["Id"], True)
                        existing = repo.fetchone(
                            "SELECT * FROM POITranslations WHERE POIId=%s AND LanguageCode=%s",
                            (final["PoiId"], final["LanguageCode"]),
                        )
                        translation = {
                            "POIId": final["PoiId"],
                            "LanguageCode": final["LanguageCode"],
                            "Name": existing["Name"]
                            if existing
                            else self._get("pois", final["PoiId"], repo)["Name"],
                            "Description": final["TextContent"],
                            "ReviewStatus": "Approved",
                            "RejectionReason": None,
                        }
                        if existing:
                            repo.lock("poi-translations", existing["Id"])
                            repo.archive("poi-translations", existing, reviewer)
                            translation["Version"] = existing["Version"] + 1
                            published = repo.update_row(
                                "poi-translations", existing["Id"], translation
                            )
                            repo.execute(
                                "UPDATE POITranslations SET IsDeleted=0 WHERE Id=%s",
                                (existing["Id"],),
                            )
                            repo.execute(
                                "UPDATE ContentSubmissions SET Status='Superseded' WHERE Resource='poi-translations' AND EntityId=%s AND Status='Pending'",
                                (existing["Id"],),
                            )
                        else:
                            published = repo.create_row("poi-translations", translation)
                        repo.update_row(
                            "narrations",
                            row["Id"],
                            {
                                "PublishedTranslationId": published["Id"],
                                "PublishedTranslationVersion": published["Version"],
                            },
                        )
            elif row.get("ReviewStatus") != "Approved":
                change = {"ReviewStatus": "Rejected", "RejectionReason": reason}
                if resource == "media":
                    change["ApprovalStatus"] = "Rejected"
                if resource == "narrations":
                    change["Status"] = "Rejected"
                repo.update_row(resource, row["Id"], change)
            repo.review_submission(
                submission,
                "Approved" if action == "approve" else "Rejected",
                reviewer,
                reason if action == "reject" else None,
            )
            return repo.fetchone(
                "SELECT * FROM ContentSubmissions WHERE Id=%s", (submission_id,)
            )

    def add_tour_translation(self, tour_id, payload):
        self._get("tours", tour_id)
        return self.create_resource("tour-translations", {**payload, "TourId": tour_id})

    def update_tour_translation(self, translation_id, payload):
        return self.update_resource("tour-translations", translation_id, payload)

    def delete_tour_translation(self, translation_id):
        self.delete_resource("tour-translations", translation_id)

    def tour_content(self, tour_id):
        tour = self.get_resource("tours", tour_id)
        members = self._repository.tour_members(tour_id)
        latest = self._repository.latest("tours", tour_id)
        if latest and latest["Status"] in {"Pending", "Rejected"}:
            proposed = json.loads(latest["PayloadJson"]).get("_pois")
            if proposed is not None:
                members = [
                    {
                        "POIId": p["poiId"],
                        "OrderIndex": i,
                        **{
                            k: v
                            for k, v in self._get("pois", p["poiId"]).items()
                            if k in {"Name", "Code"}
                        },
                    }
                    for i, p in enumerate(proposed)
                ]
        if user()["role"] not in ADMIN_ROLES | {"AnalyticsViewer"}:
            clause, params = scope("pois")
            members = [
                p
                for p in members
                if self._repository.scalar(
                    f"SELECT COUNT(*) FROM POIs WHERE Id=%s AND ({clause})",
                    (p["POIId"],) + params,
                )
            ]
        return {
            "tour": tour,
            "translations": self.by_column("tour-translations", "TourId", tour_id),
            "pois": members,
        }

    def _members(self, tour_id):
        writable()
        self._get("tours", tour_id)
        members = self.tour_content(tour_id)["pois"]
        # A scoped editor cannot accidentally remove points owned by another vendor.
        canonical = self._repository.tour_members(tour_id)
        if user()["role"] not in ADMIN_ROLES and any(
            p["POIId"] not in {r["POIId"] for r in members} for p in canonical
        ):
            raise HTTPException(
                403,
                "Tour has POIs outside your assigned scope; request access from Admin",
            )
        return [{"poiId": p["POIId"]} for p in members]

    def add_tour_poi(self, tour_id, payload):
        poi_id = payload.get("poiId") or payload.get("POIId")
        self._get("pois", poi_id)
        items = self._members(tour_id)
        if any(p["poiId"] == poi_id for p in items):
            raise HTTPException(409, "POI already belongs to tour")
        index = int(payload.get("orderIndex", len(items)))
        items.insert(max(0, min(index, len(items))), {"poiId": poi_id})
        return self._stage_members(tour_id, items)

    def _stage_members(self, tour_id, items):
        with self._repository.transaction() as repo:
            row = repo.lock("tours", tour_id)
            latest = repo.latest("tours", tour_id)
            previous = (
                json.loads(latest["PayloadJson"])
                if latest and latest["Status"] in {"Pending", "Rejected"}
                else {}
            )
            repo.submit("tours", row, {**previous, "_pois": items}, user()["id"])
        return items

    def remove_tour_poi(self, tour_id, poi_id):
        self._get("pois", poi_id)
        return self._stage_members(
            tour_id, [p for p in self._members(tour_id) if p["poiId"] != poi_id]
        )

    def reorder_tour_pois(self, tour_id, payload):
        existing = self._members(tour_id)
        items = payload if isinstance(payload, list) else payload.get("items", [])
        normalized = [{"poiId": int(p.get("poiId") or p.get("POIId"))} for p in items]
        if len(normalized) != len(existing) or {p["poiId"] for p in normalized} != {
            p["poiId"] for p in existing
        }:
            raise HTTPException(
                422, "Reorder must contain every assigned tour POI exactly once"
            )
        return self._stage_members(tour_id, normalized)

    def create_narration(self, payload, user_id):
        return self.create_resource("narrations", payload)

    def narration_action(self, draft_id, action, payload, user_id):
        self.get_resource("narrations", draft_id)
        if action in {"approve", "reject"}:
            admin()
            latest = self._repository.latest("narrations", draft_id)
            if not latest:
                raise HTTPException(409, "Submit draft for review first")
            return self.review(latest["Id"], action, (payload or {}).get("reason"))
        if action in {"submit", "resubmit"}:
            return self.submit_again("narrations", draft_id)
        if action == "text":
            return self.update_resource(
                "narrations",
                draft_id,
                {"TextContent": payload.get("textContent") or payload.get("text")},
            )
        if action in {"translations", "generate-audio"}:
            raise HTTPException(
                501,
                "Automatic translation/TTS file generation is not configured; upload audio or edit translations manually",
            )
        raise HTTPException(422, "Unknown narration action")

    def upload_media(self, file, poi_id, image_category, user_id, approved=False):
        writable()
        self._get("pois", poi_id)
        if file.content_type not in {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/ogg",
            "audio/mp4",
            "audio/aac",
            "audio/flac",
        }:
            raise HTTPException(422, "Unsupported image/audio content type")
        with self._repository.transaction() as repo:
            uploader = AdminService(repo)
            row = uploader.upload_media(
                file, poi_id, image_category, user()["id"], False
            )
            repo.submit("media", row, {}, user()["id"])
            return repo.overlay("media", row)

    def approve_media(self, media_id, user_id):
        admin()
        self._get("media", media_id)
        latest = self._repository.latest("media", media_id)
        if not latest:
            raise HTTPException(409, "Submit media first")
        return self.review(latest["Id"], "approve")

    def replace_media(self, media_id, file):
        writable()
        current = self._get("media", media_id)
        expected = "image/" if current["FileType"] == "image" else "audio/"
        if not (file.content_type or "").startswith(expected):
            raise HTTPException(422, "Replacement must have the same media type")
        allowed = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/ogg",
            "audio/mp4",
            "audio/aac",
            "audio/flac",
        }
        if file.content_type not in allowed:
            raise HTTPException(422, "Unsupported image/audio content type")
        self._get("pois", current["PoiId"])
        with self._repository.transaction() as repo:
            row = repo.lock("media", media_id)
            candidate = AdminService(repo).upload_media(
                file, row["PoiId"], row.get("ImageCategory"), user()["id"], False
            )
            # This transient row exists only inside this transaction. Move its
            # metadata into the proposal, avoiding the unique FileName constraint.
            # The file remains; the original public media id/bytes are unchanged.
            repo.execute("DELETE FROM MediaFiles WHERE Id=%s", (candidate["Id"],))
            change = {
                k: candidate[k]
                for k in (
                    "FileName",
                    "OriginalFileName",
                    "FileType",
                    "ContentType",
                    "FileSize",
                    "RelativePath",
                )
            }
            repo.submit("media", row, change, user()["id"])
            return repo.overlay("media", row)

    def reject_media(self, media_id, payload, user_id):
        admin()
        self._get("media", media_id)
        latest = self._repository.latest("media", media_id)
        if not latest:
            raise HTTPException(409, "Submit media first")
        return self.review(latest["Id"], "reject", payload.get("reason"))

    def poi_transition(self, poi_id, action, payload=None):
        admin()
        self._get("pois", poi_id)
        if action in {"approve-review", "approval-status", "reject"}:
            latest = self._repository.latest("pois", poi_id)
            if not latest:
                raise HTTPException(409, "Submit POI first")
            requested = (payload or {}).get(
                "approvalStatus", (payload or {}).get("status", 1)
            )
            if action == "approval-status" and requested not in (1, 2):
                raise HTTPException(
                    422,
                    "Choose approvalStatus 1 (approve) or 2 (reject); use resubmit for Pending",
                )
            return self.review(
                latest["Id"],
                "reject" if action == "reject" or requested == 2 else "approve",
                (payload or {}).get("reason"),
            )
        if action == "mark-paid":
            raise HTTPException(409, "Payment verification is not configured; cannot mark paid without valid transaction evidence")
        if action in {"mark-paid", "waive-payment"}:
            row = self._get("pois", poi_id)
            if row["ReviewStatus"] != "Approved":
                raise HTTPException(409, "Review POI before publishing")
            return self._repository.update_row(
                "pois",
                poi_id,
                {
                    "PaymentStatus": 2 if action == "mark-paid" else 3,
                    "LifecycleStatus": 3,
                    "Version": row["Version"] + 1,
                },
            )
        return super().poi_transition(poi_id, action, payload)

    def analytics_summary(self):
        if user()["role"] == "Vendor":
            clause, params = scope("pois")
            tour, tp = scope("tours")
            return {
                "pois": self._repository.scalar(
                    f"SELECT COUNT(*) FROM POIs WHERE DeletedAt IS NULL AND ({clause})",
                    params,
                ),
                "tours": self._repository.scalar(
                    f"SELECT COUNT(*) FROM Tours WHERE DeletedAt IS NULL AND ({tour})",
                    tp,
                ),
                "plays": self._repository.scalar(
                    f"SELECT COUNT(*) FROM NarrationLogs WHERE POIId IN (SELECT Id FROM POIs WHERE {clause})",
                    params,
                ),
                "devices": 0,
            }
        return super().analytics_summary()

    def analytics_grouped(self, group_by="poi"):
        clause, params = scope("pois")
        key = "CONVERT(date, PlayedAt)" if group_by.lower() == "date" else "POIId"
        return self._repository.fetchall(
            f"SELECT {key} AS groupKey, COUNT(*) AS plays FROM NarrationLogs WHERE POIId IN (SELECT Id FROM POIs WHERE {clause}) GROUP BY {key} ORDER BY plays DESC",
            params,
        )

    def analytics_daily(self):
        clause, params = scope("pois")
        return self._repository.fetchall(
            f"SELECT * FROM AnalyticsDaily WHERE POIId IN (SELECT Id FROM POIs WHERE {clause}) ORDER BY Date DESC",
            params,
        )

    def duration_stats(self):
        clause, params = scope("pois")
        return {
            "durationSeconds": self._repository.scalar(
                f"SELECT COALESCE(SUM(CAST(DurationPlayedSeconds AS bigint)),0) FROM NarrationLogs WHERE POIId IN (SELECT Id FROM POIs WHERE {clause})",
                params,
            ),
            "ttsPlays": None,
        }

    def sync_pull(self, payload):
        admin()
        return super().sync_pull(payload)

    def sync_push(self, payload):
        admin()
        return super().sync_push(payload)
