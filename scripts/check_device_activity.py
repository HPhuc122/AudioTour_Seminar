"""Verify live device tracking; creates and removes one isolated test device.

Does not modify accounts or passwords. No JWTs are printed.
"""
import json
import sys
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'services/auth-service'))
from app.core.database import get_connection
from app.core.config import settings
from jose import jwt


def request(path, user, device=None, expected=200):
    token = jwt.encode({'sub': str(user['Id']), 'role': user['Role'], 'exp': datetime.now(timezone.utc) + timedelta(minutes=2)}, settings.jwt_secret, algorithm='HS256')
    headers = {'Authorization': 'Bearer ' + token}
    if device:
        headers['X-Web-Device-Id'] = device
    try:
        with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/v1/' + path, headers=headers), timeout=15) as response:
            status, body = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status = error.code
        try:
            body = json.load(error)
        except ValueError:
            body = {}
    assert status == expected, f'{path.split("?")[0]}: expected {expected}, got {status}'
    return body.get('data')


with get_connection() as connection, connection.cursor() as cursor:
    cursor.execute("SELECT u.Id,r.Name AS Role FROM Users u JOIN Roles r ON r.Id=u.RoleId WHERE u.IsActive=1 AND r.Name IN ('Admin','SuperAdmin','Vendor') ORDER BY u.Id")
    accounts = cursor.fetchall()
administrator = next(u for u in accounts if u['Role'] in {'Admin', 'SuperAdmin'})
vendor = next(u for u in accounts if u['Role'] == 'Vendor')
device = 'web-' + str(uuid.uuid4())
try:
    for _ in range(2):
        profile = request('auth/me', vendor, device)
        assert profile['id'] == vendor['Id']
    data = request('cms/device-activity?activeOnly=true&search=' + device, administrator)
    assert data['total'] == 1 and len(data['items']) == 1
    row = data['items'][0]
    assert row['UserId'] == vendor['Id'] and row['IsActive']
    assert row['ActiveDevicesForUser'] >= 1
    assert 'PushToken' not in row
    request('cms/device-activity', vendor, expected=403)
    print('Live Gateway + SQL: owner binding, heartbeat deduplication, activity counts, per-user counts, Admin-only access: PASS')
finally:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute('DELETE FROM Devices WHERE DeviceId=%s AND UserId=%s', (device, vendor['Id']))
        connection.commit()
    print('Isolated test device removed; accounts and existing devices unchanged.')
