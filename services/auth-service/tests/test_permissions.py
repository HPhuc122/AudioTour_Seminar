import unittest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from jose import jwt
from app.api import auth
from app.main import app
from app.core.config import settings


class AccountPermissionTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.service = Mock()
        self.patch = patch.object(auth, "service", self.service)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.client.close()

    def headers(self, role):
        token = jwt.encode(
            {
                "sub": "12",
                "role": role,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=1),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        self.service._repository.find_by_id.return_value = {
            "id": 12,
            "role": role,
            "username": "manager",
        }
        return {"Authorization": "Bearer " + token}

    def test_vendor_cannot_read_or_modify_admin_accounts_or_roles(self):
        for method, path in [
            ("get", "/api/v1/users"),
            ("get", "/api/v1/users/1"),
            ("put", "/api/v1/users/1"),
            ("get", "/api/v1/roles"),
            ("post", "/api/v1/users"),
        ]:
            kwargs = (
                {
                    "json": {
                        "username": "x",
                        "email": "x@example.com",
                        "roleId": 1002,
                        "password": "abcdef123",
                    }
                }
                if method in {"post", "put"}
                else {}
            )
            r = getattr(self.client, method)(
                path, headers=self.headers("Vendor"), **kwargs
            )
            self.assertEqual(r.status_code, 403, r.text)
        self.service.list_users.assert_not_called()
        self.service.update_user.assert_not_called()

    def test_admin_and_superadmin_can_list_accounts(self):
        self.service.list_users.return_value = []
        for role in ("Admin", "SuperAdmin"):
            self.assertEqual(
                self.client.get(
                    "/api/v1/users", headers=self.headers(role)
                ).status_code,
                200,
            )

    def test_disabled_account_or_changed_role_invalidates_old_token(self):
        headers = self.headers("Admin")
        self.service._repository.find_by_id.return_value = None
        self.assertEqual(
            self.client.get("/api/v1/users", headers=headers).status_code, 401
        )
        self.service._repository.find_by_id.return_value = {
            "id": 12, "username": "manager", "role": "Vendor",
        }
        self.assertEqual(self.client.get('/api/v1/users', headers=headers).status_code, 401)

    def test_web_presence_uses_authenticated_owner_and_validates_device_id(self):
        device = 'web-12345678-1234-1234-1234-123456789abc'
        headers = {**self.headers('Vendor'), 'X-Web-Device-Id': device}
        response = self.client.get('/api/v1/auth/me?userId=999', headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.service._repository.record_web_presence.assert_called_once_with(12, device)
        self.assertEqual(response.json()['data']['id'], 12)
        self.service._repository.record_web_presence.reset_mock()
        response = self.client.get('/api/v1/auth/me', headers={**headers, 'X-Web-Device-Id': 'bad-id'})
        self.assertEqual(response.status_code, 422)
        self.service._repository.record_web_presence.assert_not_called()

    def test_anonymous_presence_cannot_write(self):
        response = self.client.get('/api/v1/auth/me', headers={'X-Web-Device-Id': 'web-12345678-1234-1234-1234-123456789abc'})
        self.assertEqual(response.status_code, 401)
        self.service._repository.record_web_presence.assert_not_called()
        response = self.client.post('/api/v1/auth/register-device', json={
            'deviceId': 'web-12345678-1234-1234-1234-123456789abc', 'platform': 'web',
        })
        self.assertEqual(response.status_code, 422)
        self.service.register_device.assert_not_called()
