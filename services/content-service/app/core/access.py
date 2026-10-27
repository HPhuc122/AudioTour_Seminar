from contextvars import ContextVar
from fastapi import HTTPException

ADMIN_ROLES = {"Admin", "SuperAdmin"}
WRITE_ROLES = ADMIN_ROLES | {"Vendor", "ContentAdmin", "TourOperator"}
MANAGEMENT_ROLES = WRITE_ROLES | {"AnalyticsViewer"}
actor: ContextVar[dict | None] = ContextVar("content_actor", default=None)


def user() -> dict:
    value = actor.get()
    if not value:
        raise HTTPException(401, "Authentication required")
    return value


def admin() -> dict:
    value = user()
    if value["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Only Admin/SuperAdmin can review or manage grants")
    return value


def writable() -> dict:
    value = user()
    if value["role"] not in WRITE_ROLES:
        raise HTTPException(403, "Write role required")
    return value


def scope(resource: str, value: dict | None = None) -> tuple[str, tuple]:
    value = value or user()
    if value["role"] in ADMIN_ROLES | {"AnalyticsViewer"}:
        return "1=1", ()
    if value["role"] not in WRITE_ROLES:
        return "1=0", ()
    uid = value["id"]

    def parent(kind, column):
        table = "POIs" if kind == "pois" else "Tours"
        return (
            f"EXISTS (SELECT 1 FROM {table} owned WHERE owned.Id = {column} AND (owned.UserId = %s OR EXISTS (SELECT 1 FROM EntityGrants g WHERE g.Resource = '{kind}' AND g.EntityId = owned.Id AND g.UserId = %s)))",
            (uid, uid),
        )

    if resource in {"pois", "tours"}:
        table = "POIs" if resource == "pois" else "Tours"
        return (
            f"({table}.UserId = %s OR EXISTS (SELECT 1 FROM EntityGrants g WHERE g.Resource = '{resource}' AND g.EntityId = {table}.Id AND g.UserId = %s))",
            (uid, uid),
        )
    parents = {
        "audio": ("pois", "AudioTracks.POIId"),
        "media": ("pois", "MediaFiles.PoiId"),
        "narrations": ("pois", "NarrationDrafts.PoiId"),
        "poi-translations": ("pois", "POITranslations.POIId"),
        "tour-translations": ("tours", "TourTranslations.TourId"),
        "offline_packages": ("tours", "OfflinePackages.TourId"),
        "narration_logs": ("pois", "NarrationLogs.POIId"),
    }
    if resource in parents:
        return parent(*parents[resource])
    if resource == "qr":
        poi, pp = parent("pois", "QRLocations.PoiId")
        tour, tp = parent("tours", "QRLocations.TourId")
        return f"(({poi}) OR ({tour}))", pp + tp
    return "1=0", ()
