"""Read-only CMS contract probes against the configured SQL Server.

Uses existing active accounts and short-lived local JWTs; prints no credentials.
TestClient is deliberately not entered as a context manager: no background
narration worker is started and all requests below are GETs.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'services/content-service'))

from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.core.config import settings
from app.api.admin import service

client = TestClient(app, raise_server_exceptions=False)
accounts = service._repository.fetchall(
    "SELECT u.Id,r.Name AS Role FROM Users u JOIN Roles r ON r.Id=u.RoleId "
    "WHERE u.IsActive=1 AND r.Name IN ('Admin','SuperAdmin','Vendor') ORDER BY u.Id"
)

def probe(path, headers, expected=200):
    response = client.get('/api/v1/' + path, headers=headers)
    assert response.status_code == expected, f'{path}: expected {expected}, got {response.status_code}'
    print(f'{path}: HTTP {response.status_code} PASS')
    return response.json().get('data')

probe('cms/catalog/pois', {}, 401)
for roles in [('Admin', 'SuperAdmin'), ('Vendor',)]:
    account = next((a for a in accounts if a['Role'] in roles), None)
    assert account, f'No active {roles} account to verify'
    headers = {'Authorization': 'Bearer ' + jwt.encode({
        'sub': str(account['Id']), 'role': account['Role'],
        'exp': datetime.now(timezone.utc) + timedelta(minutes=2),
    }, settings.jwt_secret, algorithm='HS256')}
    print('Role:', account['Role'])
    for resource in ['pois', 'tours', 'media', 'audio', 'narrations', 'poi-translations', 'qr']:
        result = probe(f'cms/catalog/{resource}?pageSize=2', headers)
        assert isinstance(result['items'], list) and isinstance(result['total'], int)
    for path in ['cms/console-summary', 'cms/statistics', 'cms/automation/status', 'languages?activeOnly=true']:
        probe(path, headers)
    for state in ['Pending', 'Rejected', 'Approved', 'Superseded']:
        queue = probe(f'cms/review-queue?status={state}&pageSize=2', headers)
        if queue['items']:
            dossier = probe(f"cms/review-dossier/{queue['items'][0]['Id']}", headers)
            assert all(key in dossier for key in ['submission', 'canonical', 'proposed'])
    expected = 403 if account['Role'] == 'Vendor' else 200
    for path in ['cms/catalog/users', 'cms/catalog/languages', 'cms/vendors', 'cms/validity', 'cms/transactions', 'cms/capabilities']:
        probe(path, headers, expected)
print('Read-only Admin/Vendor CMS probes: PASS')
