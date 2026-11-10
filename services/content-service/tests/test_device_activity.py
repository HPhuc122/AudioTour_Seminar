import unittest
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.api import admin, admin_console
from app.core.config import settings
from app.core.database import get_connection


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

    @unittest.skipUnless(os.getenv('AUDIOTOUR_SQL_TESTS') == '1', 'Opt-in SQL Server integration')
    def test_mobile_devices_and_distinct_web_accounts_are_counted_separately(self):
        response = self.client.get('/api/v1/cms/device-activity', headers=self.headers('Admin'))
        self.assertEqual(response.status_code, 200)
        query = self.console._repository.fetchone.call_args.args[0]
        # Run the production aggregate against connection-local temporary fixtures.
        # No rows in the application's tables are changed.
        query = query.replace('FROM Devices d', 'FROM #PresenceDevices d')
        query = query.replace('JOIN Users u', 'JOIN #PresenceUsers u')
        query = query.replace('JOIN Roles r', 'JOIN #PresenceRoles r')
        with get_connection() as connection, connection.cursor() as cursor:
            cursor.execute('CREATE TABLE #PresenceDevices (Platform varchar(20),UserId int NULL,LastSeenAt datetime2); CREATE TABLE #PresenceUsers (Id int,IsActive bit,RoleId int); CREATE TABLE #PresenceRoles (Id int,Name varchar(20));')
            cursor.execute("INSERT INTO #PresenceRoles VALUES (1,'Admin'); INSERT INTO #PresenceUsers VALUES (1,1,1),(2,1,1),(3,0,1);")
            cursor.execute("""INSERT INTO #PresenceDevices VALUES
                ('android',NULL,SYSUTCDATETIME()),('ios',NULL,SYSUTCDATETIME()),
                ('android',2,SYSUTCDATETIME()),
                ('android',NULL,DATEADD(minute,-6,SYSUTCDATETIME())),
                ('ios',NULL,DATEADD(minute,10,SYSUTCDATETIME())),
                ('web',1,SYSUTCDATETIME()),('web',1,SYSUTCDATETIME()),
                ('web',NULL,SYSUTCDATETIME()),
                ('web',2,DATEADD(minute,-6,SYSUTCDATETIME())),
                ('web',3,SYSUTCDATETIME()),('desktop',NULL,SYSUTCDATETIME())""")
            actual = cursor.execute(query).fetchone()
            self.assertEqual(actual, {'totalDevices': 5, 'activeDevices': 3, 'activeUsers': 1})
            cursor.execute('DELETE FROM #PresenceDevices')
            self.assertEqual(cursor.execute(query).fetchone(),
                             {'totalDevices': 0, 'activeDevices': 0, 'activeUsers': 0})
