import gzip
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
import main


class ProxyTests(unittest.TestCase):
    def client(self, handler):
        real_client = httpx.AsyncClient
        patcher = patch.object(main.httpx, 'AsyncClient', side_effect=lambda **options: real_client(transport=httpx.MockTransport(handler), **options))
        patcher.start(); self.addCleanup(patcher.stop)
        client = TestClient(main.app)
        self.addCleanup(client.close)
        return client

    def test_auth_routing_preserves_body_and_query(self):
        def upstream(request):
            self.assertEqual(str(request.url), main.AUTH_SERVICE_URL.rstrip('/') + '/api/v1/auth/login?source=web')
            self.assertEqual(request.content, b'{"username":"local-admin"}')
            return httpx.Response(200, json={'success': True, 'data': {'role': 'Admin'}})
        response = self.client(upstream).post('/api/v1/auth/login?source=web', content=b'{"username":"local-admin"}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['role'], 'Admin')

    def test_audio_guest_header_range_and_bytes_are_preserved(self):
        def upstream(request):
            self.assertTrue(str(request.url).startswith(main.CONTENT_SERVICE_URL.rstrip('/')))
            self.assertEqual(request.headers['X-Guest-Access-Token'], 'guest')
            self.assertEqual(request.headers['Range'], 'bytes=0-3')
            return httpx.Response(206, content=b'RIFF', headers={'content-type': 'audio/wav', 'content-range': 'bytes 0-3/100'})
        response = self.client(upstream).get('/api/v1/public/audio/7', headers={'X-Guest-Access-Token': 'guest', 'Range': 'bytes=0-3'})
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.content, b'RIFF')
        self.assertEqual(response.headers['content-range'], 'bytes 0-3/100')

    def test_unavailable_upstream_returns_api_error(self):
        for error, status in [(httpx.ConnectError, 502), (httpx.ReadTimeout, 504)]:
            with self.subTest(error=error):
                def unavailable(request):
                    raise error('upstream unavailable', request=request)
                client = self.client(unavailable)
                response = client.get('/api/v1/public/pois')
                self.assertEqual(response.status_code, status)
                self.assertIs(response.json()['success'], False)
                self.assertTrue(response.json()['message'])
                # Finish this patch before constructing the next client.
                self.doCleanups()

    def test_compressed_json_is_not_decoded_twice(self):
        body = b'{"success":true,"data":[]}'
        client = self.client(lambda request: httpx.Response(200, content=gzip.compress(body), headers={'content-type': 'application/json', 'content-encoding': 'gzip'}))
        response = client.get('/api/v1/public/pois')
        self.assertEqual(response.content, body)
        self.assertNotIn('content-encoding', response.headers)
        self.assertEqual(response.json()['data'], [])
