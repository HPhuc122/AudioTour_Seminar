"""Import prepared translations and verified MP3 files into the local demo DB.

Only inserts missing translations and new narration/media/publication rows.
Existing Vietnamese content and POI/Tour metadata are never overwritten.
"""
import hashlib
import json
import math
import sys
import argparse
import os
import zipfile
from pathlib import Path

import pyodbc
from mutagen.mp3 import MP3
from dotenv import load_dotenv
import io

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'data/prepared-demo-2026-11-10'
BATCH = 'prepared-demo-20261110'


def main():
    parser = argparse.ArgumentParser(description='Install prepared translations/audio without calling translation or TTS providers.')
    parser.add_argument('--apply', action='store_true', help='Copy verified MP3 files and import into the configured database; default is read-only validation.')
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    media_root = Path(os.getenv('MEDIA_ROOT', str(ROOT / 'services/content-service')))
    if not media_root.is_absolute():
        media_root = ROOT / media_root
    media_root = media_root.resolve()
    bundle_path = WORK / 'content-bundle.json'
    bundle = json.loads(bundle_path.read_text(encoding='utf-8'))
    snapshot = json.loads((WORK / 'source-snapshot.json').read_text(encoding='utf-8'))
    audio = json.loads((WORK / 'audio-manifest.json').read_text(encoding='utf-8'))
    receipt_path = ROOT / '.runtime/demo-content-import-receipt.json'
    digest = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
    expected = {f'{p["id"]}:{language}' for p in bundle['pois'] for language in p['translations']}
    if set(audio) != expected or len(expected) != 72:
        raise SystemExit('Need all 72 verified audio files before opening a transaction.')
    files = []
    with zipfile.ZipFile(WORK / 'audio.zip') as archive:
        for poi in bundle['pois']:
            for language, translated in poi['translations'].items():
                item = audio[f'{poi["id"]}:{language}']
                path = (media_root / item['relativePath']).resolve()
                if not path.is_relative_to(media_root / 'uploads/audio'):
                    raise SystemExit('Unexpected media path')
                raw = archive.read(item['relativePath'])
                assert hashlib.sha256(raw).hexdigest() == item['fileSha256'], 'Audio checksum mismatch'
                assert hashlib.sha256(translated['text'].encode('utf-8')).hexdigest() == item['textSha256'], 'Text checksum mismatch'
                assert MP3(io.BytesIO(raw)).info.length > 0
                if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() != item['fileSha256']:
                    raise SystemExit(f'Existing media differs: {path.name}; refusing to overwrite.')
                files.append((path, raw))
    def quoted(value):
        return '{' + str(value).replace('}', '}}') + '}'
    driver = os.getenv('SQLSERVER_ODBC_DRIVER') or 'ODBC Driver 17 for SQL Server'
    server = f"tcp:{os.getenv('SQLSERVER_HOST', 'localhost')},{os.getenv('SQLSERVER_PORT', '1433')}"
    database = os.getenv('SQLSERVER_DATABASE', 'AudioTourVinhKhanh')
    windows_auth = os.getenv('SQLSERVER_USE_WINDOWS_AUTH', 'false').lower() in {'true', '1', 'yes'}
    auth = 'Trusted_Connection=yes;' if windows_auth else f"UID={quoted(os.getenv('SQLSERVER_USER', 'sa'))};PWD={quoted(os.getenv('SQLSERVER_PASSWORD', ''))};"
    encrypt = 'yes' if os.getenv('SQLSERVER_ENCRYPT', 'true').lower() in {'true', '1', 'yes'} else 'no'
    trust = 'yes' if os.getenv('SQLSERVER_TRUST_SERVER_CERTIFICATE', 'true').lower() in {'true', '1', 'yes'} else 'no'
    connection = pyodbc.connect(f'DRIVER={quoted(driver)};SERVER={quoted(server)};DATABASE={quoted(database)};{auth}Encrypt={encrypt};TrustServerCertificate={trust}', timeout=10)
    cursor = connection.cursor()
    receipt = {'batch': BATCH, 'database': database, 'bundleSha256': digest,
               'translationOrigin': 'prepared-demo', 'audioProvider': bundle['audioProvider'], 'inserted': {}}

    def scalar(sql, params=()):
        return cursor.execute(sql, params).fetchone()[0]

    def insert(table, values):
        columns = ','.join('[' + k + ']' for k in values)
        sql = f'INSERT INTO [{table}] ({columns}) OUTPUT INSERTED.Id VALUES ({",".join("?" for _ in values)})'
        row_id = int(scalar(sql, tuple(values.values())))
        receipt['inserted'].setdefault(table, []).append(row_id)
        return row_id

    def translation(kind, item_id, language, value):
        table, parent = ('POITranslations', 'POIId') if kind == 'pois' else ('TourTranslations', 'TourId')
        row = cursor.execute(f'SELECT Id,Name,Description,Version,IsDeleted,ReviewStatus FROM {table} WITH(UPDLOCK,HOLDLOCK) WHERE {parent}=? AND LanguageCode=?', item_id, language).fetchone()
        if row:
            if row[1] != value['name'] or row[2] != value['text'] or row[4] or row[5] != 'Approved':
                raise RuntimeError(f'Existing {table} content differs for {item_id}:{language}; nothing overwritten.')
            return row[0], row[3]
        values = {parent: item_id, 'LanguageCode': language, 'Name': value['name'], 'Description': value['text'],
                  'ReviewStatus': 'Approved', 'Version': 1, 'IsDeleted': 0}
        if kind == 'pois':
            values['ShortDescription'] = value['shortDescription']
        return insert(table, values), 1

    try:
        cursor.execute('SET XACT_ABORT ON; SET LOCK_TIMEOUT 10000; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;')
        if scalar("SELECT COUNT(*) FROM AuditLogs WHERE Action='DemoSeed' AND NewValues LIKE ?", ('%' + BATCH + '%',)):
            for poi in bundle['pois']:
                for language, value in poi['translations'].items():
                    row = cursor.execute('SELECT j.ResultName,j.ResultText,a.FileUrl FROM NarrationPublications n JOIN NarrationJobs j ON j.Id=n.JobId JOIN AudioTracks a ON a.Id=n.AudioTrackId WHERE n.PoiId=? AND n.LanguageCode=? AND j.Status=\'Succeeded\' AND a.IsActive=1 AND a.DeletedAt IS NULL', poi['id'], language).fetchone()
                    assert row and tuple(row) == (value['name'], value['text'], audio[f'{poi["id"]}:{language}']['relativePath']), 'Existing publication differs; nothing overwritten'
            for kind, table, parent in [('pois', 'POITranslations', 'POIId'), ('tours', 'TourTranslations', 'TourId')]:
                for item in bundle[kind]:
                    for language, value in item['translations'].items():
                        row = cursor.execute(f'SELECT Name,Description FROM {table} WHERE {parent}=? AND LanguageCode=? AND IsDeleted=0 AND ReviewStatus=\'Approved\'', item['id'], language).fetchone()
                        assert row and tuple(row) == (value['name'], value['text']), 'Existing translation differs; nothing overwritten'
            if args.apply:
                for path, raw in files:
                    if not path.exists():
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(raw)
            connection.rollback()
            print('Prepared batch already exists in this database; verified 90 translations and 72 audio files. No SQL writes.')
            return
        reviewer = scalar("SELECT TOP 1 u.Id FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE r.Name IN ('Admin','SuperAdmin') AND u.IsActive=1 ORDER BY u.Id")
        if not reviewer:
            raise RuntimeError('Demo database needs an active admin for provenance.')
        # Refuse concurrent source edits or existing narrative/audio publications.
        for source in snapshot['pois']:
            current = cursor.execute('SELECT Code,Name,Description,ShortDescription FROM POIs WITH(UPDLOCK,HOLDLOCK) WHERE Id=? AND DeletedAt IS NULL', source['Id']).fetchone()
            assert current and tuple(current) == tuple(source.get(k) for k in ('Code', 'Name', 'Description', 'ShortDescription')), 'POI content/code differs from the prepared dataset'
            if scalar('SELECT COUNT(*) FROM NarrationHeads WHERE PoiId=?', (source['Id'],)) or scalar('SELECT COUNT(*) FROM AudioTracks WHERE POIId=? AND DeletedAt IS NULL', (source['Id'],)):
                raise RuntimeError('Existing narration/audio found; refusing to replace it.')
        for source in snapshot['tours']:
            current = cursor.execute("SELECT t.Code,tt.Name,tt.Description FROM Tours t WITH(UPDLOCK,HOLDLOCK) JOIN TourTranslations tt ON tt.TourId=t.Id AND tt.LanguageCode='vi' WHERE t.Id=? AND t.DeletedAt IS NULL AND tt.IsDeleted=0", source['Id']).fetchone()
            expected_tour = next(t['translations']['vi'] for t in bundle['tours'] if t['id'] == source['Id'])
            assert current and tuple(current) == (source['Code'], expected_tour['name'], expected_tour['text']), 'Tour content/code differs from the prepared dataset'
        if not args.apply:
            connection.rollback()
            print('Package and database preconditions verified. Run with --apply to install; no providers will be called.')
            return
        for path, raw in files:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
        for poi in bundle['pois']:
            vi = poi['translations']['vi']
            translation_ids = {lang: translation('pois', poi['id'], lang, value) for lang, value in poi['translations'].items()}
            narration_id = insert('NarrationDrafts', {'PoiId': poi['id'], 'Title': vi['name'], 'LanguageCode': 'vi',
                'TextContent': vi['text'], 'Voice': 'vi-VN', 'Status': 'AudioGenerated', 'ReviewStatus': 'Approved',
                'SubmittedByUserId': reviewer, 'ReviewedByUserId': reviewer, 'Version': 1, 'IsDeleted': 0,
                'PublishedTranslationId': translation_ids['vi'][0], 'PublishedTranslationVersion': translation_ids['vi'][1]})
            submission_id = insert('ContentSubmissions', {'Resource': 'narrations', 'EntityId': narration_id,
                'BaseVersion': 1, 'PayloadJson': json.dumps({'batch': BATCH, 'translationOrigin': 'prepared-demo',
                    'audioProvider': bundle['audioProvider'], 'source': vi}, ensure_ascii=False), 'Operation': 'update', 'Status': 'Approved',
                'SubmittedByUserId': reviewer, 'ReviewedByUserId': reviewer})
            cursor.execute('INSERT INTO NarrationHeads(PoiId,NarrationId,SourceVersion,SubmissionId) VALUES (?,?,1,?)', poi['id'], narration_id, submission_id)
            receipt['inserted'].setdefault('NarrationHeadsPoiIds', []).append(poi['id'])
            for language, translated in poi['translations'].items():
                file = audio[f'{poi["id"]}:{language}']
                filename = Path(file['relativePath']).name
                job_id = insert('NarrationJobs', {'PoiId': poi['id'], 'NarrationId': narration_id, 'SourceVersion': 1,
                    'SubmissionId': submission_id, 'ReviewerId': reviewer, 'SourceLanguage': 'vi', 'LanguageCode': language,
                    'SourceText': vi['text'], 'SourceName': vi['name'], 'SourceVoice': 'vi-VN', 'Status': 'Succeeded',
                    'Attempts': 1, 'TotalAttempts': 1, 'ResultText': translated['text'], 'ResultName': translated['name']})
                insert('MediaFiles', {'FileName': filename, 'OriginalFileName': filename, 'FileType': 'audio',
                    'ContentType': 'audio/mpeg', 'FileSize': file['fileSize'], 'RelativePath': file['relativePath'],
                    'UploadedByUserId': reviewer, 'PoiId': poi['id'], 'ApprovalStatus': 'Approved',
                    'ReviewStatus': 'Approved', 'ReviewedByUserId': reviewer, 'IsDeleted': 0, 'Version': 1})
                track_id = insert('AudioTracks', {'POIId': poi['id'], 'LanguageCode': language, 'AudioType': 'prerecorded',
                    'FileUrl': file['relativePath'], 'DurationSeconds': math.ceil(file['durationSeconds']),
                    'FileSizeBytes': file['fileSize'], 'MimeType': 'audio/mpeg', 'Title': translated['name'],
                    'IsActive': 1, 'ReviewStatus': 'Approved', 'Version': 1, 'AutomationJobId': job_id})
                cursor.execute('UPDATE NarrationJobs SET AudioTrackId=? WHERE Id=?', track_id, job_id)
                cursor.execute('INSERT INTO NarrationPublications(PoiId,LanguageCode,JobId,AudioTrackId,TranslationId,SourceVersion) VALUES (?,?,?,?,?,1)', poi['id'], language, job_id, track_id, translation_ids[language][0])
                receipt['inserted'].setdefault('NarrationPublicationKeys', []).append([poi['id'], language])
                if language == 'vi':
                    cursor.execute('UPDATE NarrationDrafts SET GeneratedAudioTrackId=?,AudioGeneratedAt=SYSUTCDATETIME(),ReviewedAt=SYSUTCDATETIME() WHERE Id=?', track_id, narration_id)
            insert('AuditLogs', {'UserId': reviewer, 'TableName': 'NarrationDrafts', 'RecordId': str(narration_id),
                'Action': 'DemoSeed', 'NewValues': json.dumps({'batch': BATCH, 'translationOrigin': 'prepared-demo', 'audioProvider': bundle['audioProvider']})})
        for tour in bundle['tours']:
            for language, value in tour['translations'].items():
                translation('tours', tour['id'], language, value)
        assert scalar('SELECT COUNT(*) FROM NarrationPublications WHERE PoiId IN (' + ','.join('?' for p in bundle['pois']) + ')', tuple(p['id'] for p in bundle['pois'])) == 72
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({table: len(ids) for table, ids in receipt['inserted'].items()}, ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
