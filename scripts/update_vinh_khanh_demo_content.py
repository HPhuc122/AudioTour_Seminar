"""Replace local demo catalog and media with the checked-in source dataset."""
from __future__ import annotations
import json, mimetypes, shutil, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "services" / "content-service"))
from initialize_local_database import DATASET_FILE, connect, execute
from app.core.config import settings

def row_value(row, key: str, index: int):
    return row[index] if not isinstance(row, dict) else row[key]

def main() -> None:
    dataset = json.loads(DATASET_FILE.read_text(encoding="utf-8-sig"))
    media_root = Path(settings.media_root).resolve()
    if not media_root.is_relative_to(ROOT):
        raise RuntimeError("MEDIA_ROOT must stay inside this repository for local demo updates")
    image_root = media_root / "uploads" / "images"
    image_root.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    price = int(dataset.get("demoAccessPriceVnd", 100000))
    connection, is_odbc = connect("AudioTourVinhKhanh", autocommit=False)
    poi_ids = {}
    try:
        cursor = connection.cursor()
        for priority, poi in enumerate(dataset["poi"], 1):
            code = poi["code"]
            execute(cursor, "SELECT Id FROM POIs WHERE Code=%s AND DeletedAt IS NULL", (code,), is_odbc)
            row = cursor.fetchone()
            if row is None: raise RuntimeError(f"POI not found: {code}")
            poi_id = int(row_value(row, "Id", 0)); poi_ids[code] = poi_id
            execute(cursor, "UPDATE POIs SET Address=%s,Latitude=%s,Longitude=%s,Category=%s,Description=%s,Name=%s,ShortDescription=%s,ImageUrl=NULL,ImageUrls=NULL,Priority=%s,UpdatedAt=%s,Version=Version+1,ApprovalStatus=1,ReviewStatus='Approved',RejectionReason=NULL WHERE Id=%s", (poi["address"],poi["latitude"],poi["longitude"],poi["category"],poi["narration"],poi["name"],poi["shortDescription"],priority,now,poi_id), is_odbc)
            execute(cursor, "UPDATE POITranslations SET Name=%s,Description=%s,ShortDescription=%s,UpdatedAt=%s,Version=Version+1,ReviewStatus='Approved',RejectionReason=NULL,IsDeleted=0 WHERE POIId=%s AND LanguageCode='vi'", (poi["name"],poi["narration"],poi["shortDescription"],now,poi_id), is_odbc)
            if cursor.rowcount == 0:
                execute(cursor, "INSERT INTO POITranslations (POIId,LanguageCode,Name,Description,ShortDescription,Version,CreatedAt,UpdatedAt,ReviewStatus,RejectionReason,IsDeleted) VALUES (%s,'vi',%s,%s,%s,1,%s,%s,'Approved',NULL,0)", (poi_id,poi["name"],poi["narration"],poi["shortDescription"],now,now), is_odbc)
            execute(cursor, "UPDATE MediaFiles SET IsDeleted=1 WHERE PoiId=%s AND FileType='image' AND IsDeleted=0", (poi_id,), is_odbc)
            files = poi.get("imageFiles", [])
            if len(files) < 2: raise RuntimeError(f"{code} needs Highlight and Menu photos")
            for index, rel in enumerate(files):
                source = (DATASET_FILE.parent / rel).resolve()
                if DATASET_FILE.parent.resolve() not in source.parents or not source.is_file(): raise RuntimeError(f"Missing dataset image: {rel}")
                filename=f"{code.lower()}-{source.name}"; dest=image_root/filename; shutil.copy2(source,dest)
                category = "Highlight" if index == 0 else "Menu"
                content_type = mimetypes.guess_type(source.name)[0] or "image/jpeg"
                relative_path = f"uploads/images/{filename}"
                size = dest.stat().st_size
                execute(cursor, "SELECT Id FROM MediaFiles WHERE FileName=%s", (filename,), is_odbc)
                existing_media = cursor.fetchone()
                if existing_media:
                    media_id = row_value(existing_media, "Id", 0)
                    execute(cursor, "UPDATE MediaFiles SET OriginalFileName=%s,FileType='image',ContentType=%s,FileSize=%s,RelativePath=%s,UploadedAt=%s,IsDeleted=0,ApprovalStatus='Approved',SubmittedAt=%s,PoiId=%s,ImageCategory=%s,ReviewStatus='Approved',RejectionReason=NULL,Version=Version+1 WHERE Id=%s", (source.name,content_type,size,relative_path,now,now,poi_id,category,media_id), is_odbc)
                else:
                    execute(cursor, "INSERT INTO MediaFiles (FileName,OriginalFileName,FileType,ContentType,FileSize,RelativePath,UploadedAt,UploadedByUserId,IsDeleted,ApprovalStatus,SubmittedAt,PoiId,ImageCategory,ReviewStatus,RejectionReason,Version) VALUES (%s,%s,'image',%s,%s,%s,%s,NULL,0,'Approved',%s,%s,%s,'Approved',NULL,1)", (filename,source.name,content_type,size,relative_path,now,now,poi_id,category), is_odbc)
            execute(cursor, "UPDATE QRLocations SET Name=%s,UpdatedAt=%s WHERE PoiId=%s AND DeletedAt IS NULL", (poi["name"],now,poi_id), is_odbc)
        for tour in dataset["tours"]:
            execute(cursor, "SELECT Id FROM Tours WHERE Code=%s AND DeletedAt IS NULL", (tour["code"],), is_odbc); row=cursor.fetchone()
            if row is None: raise RuntimeError(f"Tour not found: {tour['code']}")
            tour_id=int(row_value(row,"Id",0))
            execute(cursor,"UPDATE Tours SET EstimatedMinutes=%s,UpdatedAt=%s,Version=Version+1,ReviewStatus='Approved',RejectionReason=NULL WHERE Id=%s",(tour["estimatedMinutes"],now,tour_id),is_odbc)
            execute(cursor,"UPDATE TourTranslations SET Name=%s,Description=%s,Version=Version+1,ReviewStatus='Approved',RejectionReason=NULL,IsDeleted=0 WHERE TourId=%s AND LanguageCode='vi'",(tour["name"],tour["description"],tour_id),is_odbc)
            if cursor.rowcount==0: execute(cursor,"INSERT INTO TourTranslations (TourId,LanguageCode,Name,Description,ReviewStatus,RejectionReason,Version,IsDeleted) VALUES (%s,'vi',%s,%s,'Approved',NULL,1,0)",(tour_id,tour["name"],tour["description"]),is_odbc)
            execute(cursor,"DELETE FROM TourPOIs WHERE TourId=%s",(tour_id,),is_odbc)
            for order,code in enumerate(tour["poiCodes"]): execute(cursor,"INSERT INTO TourPOIs (TourId,POIId,OrderIndex) VALUES (%s,%s,%s)",(tour_id,poi_ids[code],order),is_odbc)
            execute(cursor,"UPDATE QRLocations SET Name=%s,UpdatedAt=%s WHERE TourId=%s AND DeletedAt IS NULL",(tour["name"],now,tour_id),is_odbc)
        execute(cursor,"UPDATE QRLocations SET Name=N'Gói demo toàn bộ POI · 60 phút',PriceAmount=%s,AccessDurationMinutes=60,RequiresPayment=1,IsActive=1,DeletedAt=NULL,UpdatedAt=%s WHERE Code='VK-ALL-POI-ACCESS'",(price,now),is_odbc)
        connection.commit(); cursor.close()
    except Exception:
        connection.rollback(); raise
    finally: connection.close()
    print("Updated POI, Tour, QR and photo data from source.vi.json; translations and audio left unchanged.")
if __name__ == "__main__": main()
