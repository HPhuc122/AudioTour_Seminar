"""Create a fresh local SQL Server database from the checked-in photo-backed demo seed."""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE_ROOT = ROOT / "services" / "content-service"
sys.path.insert(0, str(SERVICE_ROOT))

import bcrypt

from app.core.config import settings


DATABASE_NAME = "AudioTourVinhKhanh"
SCHEMA_FILES = (
    ROOT / "infra" / "sql" / "000_vinh_khanh_baseline.sql",
    ROOT / "infra" / "sql" / "001_scope_and_review.sql",
    ROOT / "infra" / "sql" / "002_narration_publication.sql",
    ROOT / "services" / "content-service" / "migrations" / "004_narration_jobs.sql",
    ROOT / "infra" / "sql" / "005_web_device_presence.sql",
    ROOT / "infra" / "sql" / "006_poi_address.sql",
)
DATASET_FILE = ROOT / "data" / "vinh-khanh-demo" / "source.vi.json"
DEMO_ACCOUNT_PASSWORD = "123456"


def connect(database: str, autocommit: bool):
    if settings.use_windows_auth or settings.odbc_driver:
        import pyodbc

        driver = settings.odbc_driver or "ODBC Driver 18 for SQL Server"
        server = f"tcp:{settings.host},{settings.port}"
        auth = (
            "Trusted_Connection=yes;"
            if settings.use_windows_auth
            else f"UID={_odbc_value(settings.user)};PWD={_odbc_value(settings.password)};"
        )
        connection = pyodbc.connect(
            f"DRIVER={_odbc_value(driver)};SERVER={_odbc_value(server)};"
            f"DATABASE={_odbc_value(database)};{auth}"
            f"Encrypt={'yes' if settings.encrypt else 'no'};"
            f"TrustServerCertificate={'yes' if settings.trust_server_certificate else 'no'};",
            timeout=10,
            autocommit=autocommit,
        )
        return connection, True

    import pymssql

    connection = pymssql.connect(
        server=settings.host,
        port=str(settings.port),
        user=settings.user,
        password=settings.password,
        database=database,
        as_dict=True,
        timeout=10,
        login_timeout=10,
    )
    connection.autocommit(autocommit)
    return connection, False


def _odbc_value(value: str) -> str:
    return "{" + value.replace("}", "}}") + "}"


def execute(cursor, sql: str, params: tuple = (), is_odbc: bool = False):
    return cursor.execute(sql.replace("%s", "?") if is_odbc else sql, params)


def batches(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    return [batch.strip() for batch in re.split(r"(?im)^\s*GO\s*$", text) if batch.strip()]


def apply_schema(database: str) -> None:
    connection, is_odbc = connect(database, autocommit=True)
    try:
        cursor = connection.cursor()
        for path in SCHEMA_FILES:
            for batch in batches(path):
                execute(cursor, batch, is_odbc=is_odbc)
        cursor.close()
    finally:
        connection.close()


def create_database(reset: bool) -> None:
    connection, is_odbc = connect("master", autocommit=True)
    try:
        cursor = connection.cursor()
        execute(
            cursor,
            f"SELECT DB_ID(N'{DATABASE_NAME}') AS DatabaseId",
            is_odbc=is_odbc,
        )
        exists = cursor.fetchone()[0 if is_odbc else "DatabaseId"] is not None
        if exists and not reset:
            raise RuntimeError(
                f"{DATABASE_NAME} already exists. Add --reset to replace only this demo database."
            )
        if exists:
            execute(
                cursor,
                f"ALTER DATABASE [{DATABASE_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE",
                is_odbc=is_odbc,
            )
            execute(cursor, f"DROP DATABASE [{DATABASE_NAME}]", is_odbc=is_odbc)
        execute(cursor, f"CREATE DATABASE [{DATABASE_NAME}]", is_odbc=is_odbc)
        cursor.close()
    finally:
        connection.close()


def _identity(cursor, is_odbc: bool) -> int:
    row = cursor.fetchone()
    return int(row[0] if is_odbc else next(iter(row.values())))


def seed_database(database: str) -> str:
    dataset = json.loads(DATASET_FILE.read_text(encoding="utf-8"))
    media_root = Path(settings.media_root).resolve()
    if not media_root.is_relative_to(ROOT):
        raise RuntimeError("MEDIA_ROOT must stay inside this repository for local demo seeding")
    image_root = media_root / "uploads" / "images"
    image_root.mkdir(parents=True, exist_ok=True)

    connection, is_odbc = connect(database, autocommit=False)
    password = DEMO_ACCOUNT_PASSWORD
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    poi_ids: dict[str, int] = {}
    tour_ids: dict[str, int] = {}
    try:
        cursor = connection.cursor()
        execute(cursor, "SELECT COUNT(*) AS total FROM POIs", is_odbc=is_odbc)
        if int(cursor.fetchone()[0 if is_odbc else "total"]):
            raise RuntimeError("Fresh database contains POIs; refusing to mix seed data")

        role_ids = {}
        for role, description in (
            ("Admin", "Local demo administrator"),
            ("ContentAdmin", "Local demo content editor"),
            ("Vendor", "Local demo vendor"),
            ("TourOperator", "Local demo tour editor"),
        ):
            execute(
                cursor,
                "INSERT INTO Roles (Name,Description) OUTPUT INSERTED.Id VALUES (%s,%s)",
                (role, description),
                is_odbc,
            )
            role_ids[role] = _identity(cursor, is_odbc)

        demo_users = [("local-admin", "local-admin@audiotour.test", "Admin", None)]
        for index, poi in enumerate(dataset["poi"], start=1):
            username = "local-vendor" if index == 1 else f"local-vendor-{index:02d}"
            demo_users.append((username, f"{username}@audiotour.test", "Vendor", poi["code"]))

        vendor_ids_by_poi: dict[str, int] = {}
        for username, email, role, poi_code in demo_users:
            execute(
                cursor,
                "INSERT INTO Users (Username,Email,PasswordHash,RoleId,PreferredLanguage,IsActive,CreatedAt,UpdatedAt) "
                "OUTPUT INSERTED.Id VALUES (%s,%s,%s,%s,'vi',1,%s,%s)",
                (
                    username,
                    email,
                    bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii"),
                    role_ids[role],
                    now,
                    now,
                ),
                is_odbc,
            )
            user_id = _identity(cursor, is_odbc)
            if poi_code:
                vendor_ids_by_poi[poi_code] = user_id

        for order, (code, name, native_name) in enumerate(
            (
                ("vi", "Vietnamese", "Tiếng Việt"),
                ("en", "English", "English"),
                ("zh", "Chinese", "中文"),
                ("ko", "Korean", "한국어"),
                ("ja", "Japanese", "日本語"),
                ("fr", "French", "Français"),
            )
        ):
            execute(
                cursor,
                "INSERT INTO Languages (Code,Name,NativeName,IsActive,SortOrder) VALUES (%s,%s,%s,1,%s)",
                (code, name, native_name, order),
                is_odbc,
            )

        for priority, poi in enumerate(dataset["poi"], start=1):
            execute(
                cursor,
                "INSERT INTO POIs (Code,Address,Latitude,Longitude,RadiusMeters,Priority,IsActive,ImageUrl,Category,"
                "CooldownSeconds,MinDwellSeconds,DeletedAt,Version,CreatedAt,UpdatedAt,ApprovalStatus,Description,"
                "Name,ShortDescription,ImageUrls,UserId,ActivatedAt,ActivatedByUserId,PaymentRequired,PaymentStatus,"
                "LifecycleStatus,ValidFrom,ValidUntil,ReviewStatus,RejectionReason) "
                "OUTPUT INSERTED.Id VALUES (%s,%s,%s,%s,100,%s,1,NULL,%s,300,5,NULL,1,%s,%s,1,%s,%s,%s,NULL,%s,NULL,NULL,0,3,3,NULL,NULL,'Approved',NULL)",
                (
                    poi["code"],
                    poi.get("address"),
                    poi.get("latitude"),
                    poi.get("longitude"),
                    priority,
                    poi["category"],
                    now,
                    now,
                    poi["narration"],
                    poi["name"],
                    poi["shortDescription"],
                    vendor_ids_by_poi[poi["code"]],
                ),
                is_odbc,
            )
            poi_id = _identity(cursor, is_odbc)
            poi_ids[poi["code"]] = poi_id
            execute(
                cursor,
                "INSERT INTO POITranslations (POIId,LanguageCode,Name,Description,ShortDescription,Version,CreatedAt,UpdatedAt,ReviewStatus,RejectionReason,IsDeleted) "
                "VALUES (%s,'vi',%s,%s,%s,1,%s,%s,'Approved',NULL,0)",
                (poi_id, poi["name"], poi["narration"], poi["shortDescription"], now, now),
                is_odbc,
            )

            for image_index, relative_source in enumerate(poi.get("imageFiles", [])):
                source = (DATASET_FILE.parent / relative_source).resolve()
                if DATASET_FILE.parent.resolve() not in source.parents or not source.is_file():
                    raise RuntimeError(f"Demo image not found inside dataset package: {relative_source}")
                filename = f"{poi['code'].lower()}-{source.name}"
                destination = image_root / filename
                shutil.copy2(source, destination)
                relative_target = f"uploads/images/{filename}"
                file_size = destination.stat().st_size
                if file_size <= 0:
                    raise RuntimeError(f"Demo image is empty: {relative_source}")
                image_category = "Highlight" if image_index == 0 else "Menu"
                execute(
                    cursor,
                    "INSERT INTO MediaFiles (FileName,OriginalFileName,FileType,ContentType,FileSize,RelativePath,UploadedAt,UploadedByUserId,IsDeleted,ApprovalStatus,SubmittedAt,PoiId,ImageCategory,ReviewStatus) "
                    "VALUES (%s,%s,'image',%s,%s,%s,%s,NULL,0,'Approved',%s,%s,%s,'Approved')",
                    (filename, source.name, mimetypes.guess_type(source.name)[0] or "application/octet-stream", file_size, relative_target, now, now, poi_id, image_category),
                    is_odbc,
                )

        for tour in dataset["tours"]:
            execute(
                cursor,
                "INSERT INTO Tours (Code,DefaultLanguage,IsActive,EstimatedMinutes,DeletedAt,Version,CreatedAt,UpdatedAt,UserId,ReviewStatus,RejectionReason) "
                "OUTPUT INSERTED.Id VALUES (%s,'vi',1,%s,NULL,1,%s,%s,NULL,'Approved',NULL)",
                (tour["code"], tour["estimatedMinutes"], now, now),
                is_odbc,
            )
            tour_id = _identity(cursor, is_odbc)
            tour_ids[tour["code"]] = tour_id
            execute(
                cursor,
                "INSERT INTO TourTranslations (TourId,LanguageCode,Name,Description,ReviewStatus,RejectionReason,Version,IsDeleted) "
                "VALUES (%s,'vi',%s,%s,'Approved',NULL,1,0)",
                (tour_id, tour["name"], tour["description"]),
                is_odbc,
            )
            for order, poi_code in enumerate(tour["poiCodes"]):
                execute(
                    cursor,
                    "INSERT INTO TourPOIs (TourId,POIId,OrderIndex) VALUES (%s,%s,%s)",
                    (tour_id, poi_ids[poi_code], order),
                    is_odbc,
                )

        demo_price = dataset.get("demoAccessPriceVnd", 100000)
        for poi in dataset["poi"]:
            execute(
                cursor,
                "INSERT INTO QRLocations (PoiId,TourId,Code,IsActive,DeletedAt,CreatedAt,UpdatedAt,AccessDurationMinutes,PriceAmount,RequiresPayment,Name) VALUES (%s,NULL,%s,1,NULL,%s,%s,60,%s,1,%s)",
                (poi_ids[poi["code"]], f"VK-POI-{poi['code']}", now, now, demo_price, poi["name"]),
                is_odbc,
            )
        for tour in dataset["tours"]:
            execute(
                cursor,
                "INSERT INTO QRLocations (PoiId,TourId,Code,IsActive,DeletedAt,CreatedAt,UpdatedAt,AccessDurationMinutes,PriceAmount,RequiresPayment,Name) VALUES (NULL,%s,%s,1,NULL,%s,%s,60,%s,1,%s)",
                (tour_ids[tour["code"]], f"VK-TOUR-{tour['code']}", now, now, demo_price, tour["name"]),
                is_odbc,
            )
        execute(
            cursor,
            "INSERT INTO QRLocations (PoiId,TourId,Code,IsActive,DeletedAt,CreatedAt,UpdatedAt,AccessDurationMinutes,PriceAmount,RequiresPayment,Name) VALUES (NULL,NULL,'VK-ALL-POI-ACCESS',1,NULL,%s,%s,60,%s,1,'Toàn bộ POI demo · 60 phút')",
            (now, now, demo_price),
            is_odbc,
        )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return password


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset",
        action="store_true",
        help=f"Drop and recreate only {DATABASE_NAME}; leaves the legacy database untouched.",
    )
    args = parser.parse_args()
    if settings.database != DATABASE_NAME:
        raise RuntimeError(f"Set SQLSERVER_DATABASE={DATABASE_NAME} in .env before running")
    if not DATASET_FILE.is_file():
        raise RuntimeError(f"Demo dataset is missing: {DATASET_FILE}")
    if not all(path.is_file() for path in SCHEMA_FILES):
        raise RuntimeError("One or more project schema/migration files are missing")

    create_database(args.reset)
    apply_schema(DATABASE_NAME)
    password = seed_database(DATABASE_NAME)
    print(f"Created {DATABASE_NAME} with the HCMC photo demo seed.")
    print("Admin login: local-admin")
    dataset = json.loads(DATASET_FILE.read_text(encoding="utf-8"))
    print("Vendor logins by POI:")
    for index, poi in enumerate(dataset["poi"], start=1):
        username = "local-vendor" if index == 1 else f"local-vendor-{index:02d}"
        print(f"  {poi['code']}: {username}")
    print("Demo password for all local accounts: 123456")
    print("POIs without confirmed storefront coordinates remain hidden from map routing until geocoded.")
    print("This is a local-only database/media copy; content edits do not sync to another computer.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Local database setup failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
