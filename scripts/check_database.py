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
    cursor.execute("SELECT RelativePath FROM MediaFiles WHERE IsDeleted=0")
    files = cursor.fetchall()
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
