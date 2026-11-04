"""Read-only SQL/API audit. Never creates sessions, logs, submissions or approvals."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/content-service'))
from app.core.config import settings
from app.core.database import get_connection
from app.repositories.content_repository import ContentRepository


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')

    def get(path):
        with urlopen(base + path, timeout=15) as response:
            body = json.load(response)
        assert body['success'], path
        return body['data']

    def denied(path, expected):
        try:
            get(path)
        except HTTPError as error:
            assert error.code == expected, (path, error.code)
        else:
            raise AssertionError('Unexpected access: ' + path)

    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute('SELECT DB_NAME() AS name')
        database = cursor.fetchone()['name']
        assert database == 'AudioTourVinhKhanh', database
        cursor.execute(f'SELECT p.Id, p.Code FROM POIs p WHERE {ContentRepository.PUBLIC_POI_WHERE}')
        sql_pois = cursor.fetchall()
        cursor.execute("SELECT Id FROM Tours WHERE IsActive=1 AND DeletedAt IS NULL AND ReviewStatus='Approved'")
        sql_tours = cursor.fetchall()
        cursor.execute("SELECT Id,PoiId,RelativePath,Version FROM MediaFiles WHERE FileType='image' AND IsDeleted=0 AND ReviewStatus='Approved' AND ApprovalStatus='Approved'")
        sql_images = {r['Id']: r for r in cursor.fetchall()}
        cursor.execute('SELECT Id,Code,PoiId,TourId FROM QRLocations WHERE IsActive=1 AND DeletedAt IS NULL')
        qrs = cursor.fetchall()
        cursor.execute('SELECT COUNT(*) AS total FROM AudioTracks WHERE DeletedAt IS NULL')
        audio_count = cursor.fetchone()['total']
        cursor.execute(f'SELECT COUNT(*) AS total FROM POIs p WHERE {ContentRepository.PUBLIC_POI_WHERE} AND p.Latitude IS NOT NULL AND p.Longitude IS NOT NULL')
        gps_count = cursor.fetchone()['total']

    pois, page = [], 1
    while True:
        result = get(f'/api/v1/public/pois?lang=vi&page={page}&pageSize=100')
        pois.extend(result['items'])
        if len(pois) >= result['total']:
            break
        assert result['items'], 'Pagination stalled'
        page += 1
    assert {p['id'] for p in pois} == {p['Id'] for p in sql_pois}, 'SQL/API POI mismatch'
    tours = get('/api/v1/public/tours?lang=vi')
    assert {t['id'] for t in tours} == {t['Id'] for t in sql_tours}, 'SQL/API tour mismatch'
    image_ids = set()
    for poi in pois:
        detail = get(f"/api/v1/public/pois/{poi['id']}?lang=vi")
        assert detail['code'] == poi['code']
        for image in detail['images']:
            stored = sql_images[image['id']]
            assert stored['PoiId'] == poi['id'], 'Image belongs to another POI'
            assert image['version'] == stored['Version'], 'Image version mismatch'
            path = (Path(settings.media_root) / stored['RelativePath']).resolve()
            assert Path(settings.media_root).resolve() in path.parents
            with urlopen(base + f"/api/v1/public/media/images/{image['id']}", timeout=15) as response:
                assert response.headers['Content-Type'].startswith('image/')
                assert hashlib.sha256(response.read()).digest() == hashlib.sha256(path.read_bytes()).digest()
            image_ids.add(image['id'])
        if poi.get('thumbnailImageId'):
            assert poi['thumbnailImageId'] in {image['id'] for image in detail['images']}
            assert poi['thumbnailImageVersion'] == sql_images[poi['thumbnailImageId']]['Version']
        denied(f"/api/v1/public/audio-tour/pois/{poi['id']}?languageCode=vi", 401)
    for tour in tours:
        detail = get(f"/api/v1/public/tours/{tour['id']}?lang=vi")
        assert all(p['id'] in {row['id'] for row in pois} for p in detail['pois'])
        order = [p['orderIndex'] for p in detail['pois']]
        assert order == sorted(order), 'Tour order mismatch'
        denied(f"/api/v1/public/audio-tour/tours/{tour['id']}?languageCode=vi", 401)
    checked_qrs = 0
    for qr in qrs:
        if not (qr['PoiId'] or qr['TourId']):
            continue  # Global packages use /public/packages rather than a detail destination.
        target = get('/api/v1/qr/resolve/' + quote(qr['Code'], safe=''))
        assert target['targetId'] == (qr['PoiId'] or qr['TourId'])
        assert target['targetType'] == ('poi' if qr['PoiId'] else 'tour')
        checked_qrs += 1
    denied('/api/v1/qr/resolve/AUDIT-NONEXISTENT-QR', 404)
    denied('/api/v1/cms/catalog/pois', 401)
    print(json.dumps({'database': database, 'api': base, 'publicPois': len(pois),
        'publicTours': len(tours), 'verifiedImageBytes': len(image_ids), 'resolvedQrTargets': checked_qrs,
        'audioTracks': audio_count, 'publicPoisWithCoordinates': gps_count,
        'anonymousAudioAccess': 'denied', 'result': 'PASS'}, indent=2))


if __name__ == '__main__':
    main()
