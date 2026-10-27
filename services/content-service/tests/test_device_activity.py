import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.api import admin, admin_console
from app.core.config import settings


class DeviceActivityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.accounts = Mock()
        self.console = Mock()
        self.auth_patch = patch.object(admin, 'service', self.accounts)
        self.console_patch = patch.object(admin_console, 'service', self.console)
        self.auth_patch.start()
        self.console_patch.start()
        self.addCleanup(self.auth_patch.stop)
        self.addCleanup(self.console_patch.stop)
        self.addCleanup(self.client.close)
        self.console._repository.fetchone.return_value = {'totalDevices': 4, 'activeDevices': 2, 'activeUsers': 1}
        self.console._repository.scalar.return_value = 1
        self.console._repository.fetchall.return_value = [{'Id': 3, 'UserId': 12, 'Username': 'vendor', 'Platform': 'web', 'IsActive': True}]

    def headers(self, role):
        self.accounts._repository.fetchone.return_value = {'Id': 12, 'Role': role}
        token = jwt.encode({'sub': '12', 'role': role, 'exp': datetime.now(timezone.utc) + timedelta(minutes=1)}, settings.jwt_secret, algorithm='HS256')
        return {'Authorization': 'Bearer ' + token}

    def test_only_admins_can_read_devices(self):
        self.assertEqual(self.client.get('/api/v1/cms/device-activity').status_code, 401)
        for role in ['Vendor', 'TourOperator', 'ContentAdmin', 'AnalyticsViewer']:
            self.assertEqual(self.client.get('/api/v1/cms/device-activity', headers=self.headers(role)).status_code, 403)
        self.console._repository.fetchall.assert_not_called()
        for role in ['Admin', 'SuperAdmin']:
            response = self.client.get('/api/v1/cms/device-activity', headers=self.headers(role))
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['data']['summary']['activeUsers'], 1)

    def test_filters_are_parameterized_and_presence_uses_server_time(self):
        response = self.client.get('/api/v1/cms/device-activity', params={'activeOnly': 'true', 'search': "x%'", 'page': 2, 'pageSize': 20}, headers=self.headers('Admin'))
        self.assertEqual(response.status_code, 200, response.text)
        query, values = self.console._repository.fetchall.call_args.args
        self.assertNotIn("x%'", query)
        self.assertIn('DATEADD(minute,-5,SYSUTCDATETIME())', query)
        self.assertIn('COUNT(DISTINCT CASE', self.console._repository.fetchone.call_args.args[0])
        self.assertNotIn('PushToken', query)
        self.assertEqual(values[-2:], (20, 20))
        self.assertEqual(response.json()['data']['activeWindowMinutes'], 5)

    def test_invalid_pagination_is_rejected(self):
        for params in [{'page': 0}, {'pageSize': 101}, {'search': 'x' * 201}]:
            self.assertEqual(self.client.get('/api/v1/cms/device-activity', params=params, headers=self.headers('Admin')).status_code, 422)
