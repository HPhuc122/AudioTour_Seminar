"""Read-only schema/data/media inventory; do not print account secrets."""

import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "services/content-service"))
from app.core.config import settings
from app.core.database import get_connection

report = {"database": settings.database, "mediaRoot": settings.media_root}
with get_connection() as connection, connection.cursor() as cursor:
    for table in (
        "POIs",
        "Tours",
        "AudioTracks",
        "MediaFiles",
        "POITranslations",
        "TourTranslations",
        "NarrationDrafts",
    ):
        cursor.execute(
            f"SELECT ReviewStatus, COUNT(*) AS total FROM {table} GROUP BY ReviewStatus"
        )
        report[table] = cursor.fetchall()
    cursor.execute(
        "SELECT COUNT(*) AS total FROM POIs WHERE IsActive=1 AND DeletedAt IS NULL AND LifecycleStatus=3 AND ApprovalStatus=1 AND ReviewStatus='Approved' AND (ValidFrom IS NULL OR ValidFrom <= SYSUTCDATETIME()) AND (ValidUntil IS NULL OR ValidUntil >= SYSUTCDATETIME())"
    )
    report["publicPois"] = cursor.fetchone()["total"]
    cursor.execute("SELECT Id, PoiId, FileType, RelativePath FROM MediaFiles WHERE IsDeleted=0 ORDER BY Id")
    files = cursor.fetchall()
    root_path = Path(settings.media_root).resolve()
    report["missingMedia"] = []
    for item in files:
        path = (root_path / str(item["RelativePath"]).replace("\\", "/")).resolve()
        if root_path not in path.parents or not path.is_file():
            report["missingMedia"].append({**item, "reason": "outside MEDIA_ROOT" if root_path not in path.parents else "file missing"})
    cursor.execute("SELECT Id, POIId, FileUrl FROM AudioTracks WHERE DeletedAt IS NULL AND FileUrl IS NOT NULL ORDER BY Id")
    report["missingAudio"] = []
    for item in cursor.fetchall():
        path = (root_path / str(item["FileUrl"]).replace("\\", "/")).resolve()
        if root_path not in path.parents or not path.is_file():
            report["missingAudio"].append(item)
    report["mediaFilesPresent"] = sum(
        (
            Path(settings.media_root) / str(f["RelativePath"]).replace("\\", "/")
        ).is_file()
        for f in files
    )
    report["mediaFilesMissing"] = len(files) - report["mediaFilesPresent"]
    cursor.execute(
        "SELECT COUNT(*) AS total FROM POIs WHERE DeletedAt IS NULL AND ValidUntil < SYSUTCDATETIME()"
    )
    report["expiredPois"] = cursor.fetchone()["total"]
print(json.dumps(report, ensure_ascii=False, indent=2))
