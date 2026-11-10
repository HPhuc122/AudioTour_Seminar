import asyncio
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.device_registration import register_device


class DeviceRegistrationTests(unittest.TestCase):
    def forward(self, handler):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch('app.services.device_registration.httpx.AsyncClient', return_value=client):
            asyncio.run(register_device({'deviceId': 'mobile-test', 'platform': 'android'}))

    def test_only_registration_payload_is_forwarded(self):
        def handler(request):
            self.assertEqual(request.url.path, '/api/v1/auth/register-device')
            self.assertEqual(request.method, 'POST')
            self.assertNotIn('authorization', request.headers)
            self.assertIn(b'"deviceId":"mobile-test"', request.content)
            return httpx.Response(200, json={'success': True})
        self.forward(handler)

    def test_auth_validation_remains_enforced(self):
        with self.assertRaises(HTTPException) as raised:
            self.forward(lambda request: httpx.Response(422))
        self.assertEqual(raised.exception.status_code, 422)

    def test_auth_timeout_does_not_leak_internal_details(self):
        def handler(request):
            raise httpx.ReadTimeout('internal details', request=request)
        with self.assertRaises(HTTPException) as raised:
            self.forward(handler)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertNotIn('internal details', raised.exception.detail)

    def test_auth_failure_returns_bad_gateway(self):
        with self.assertRaises(HTTPException) as raised:
            self.forward(lambda request: httpx.Response(500))
        self.assertEqual(raised.exception.status_code, 502)

    def test_content_route_preserves_auth_request_and_response_contract(self):
        async def forward(payload):
            self.assertEqual(payload, {'deviceId': 'mobile-test', 'platform': 'android', 'osVersion': '16'})
        client = TestClient(app)
        self.addCleanup(client.close)
        with patch('app.api.public.forward_device_registration', side_effect=forward):
            result = client.post('/api/v1/auth/register-device', json={
                'deviceId': 'mobile-test', 'platform': 'android', 'osVersion': '16'})
            self.assertEqual(result.status_code, 200)
            self.assertTrue(result.json()['success'])
            self.assertEqual(client.post('/api/v1/auth/register-device', json={}).status_code, 422)
