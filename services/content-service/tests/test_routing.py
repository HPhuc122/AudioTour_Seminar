import io
import json
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from pydantic import ValidationError
from app.api.public import RouteRequest
from app.services.routing_service import RoutingService
from app.services.content_service import ContentService


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.points = [{"latitude": 10.75, "longitude": 106.7}, {"latitude": 10.76, "longitude": 106.71}]
        self.body = {"features": [{"geometry": {"type": "LineString", "coordinates": [[106.7, 10.75], [106.705, 10.753], [106.71, 10.76]]}, "properties": {"summary": {"distance": 1832.4, "duration": 1452.3}}}]}
        self.config = patch("app.services.routing_service.settings", SimpleNamespace(open_route_service_api_key="test-key"))
        self.config.start()
        self.addCleanup(self.config.stop)

    def test_profiles_coordinates_and_real_summary(self):
        for mode, profile in [("walking", "foot-walking"), ("driving", "driving-car")]:
            with patch("app.services.routing_service.urlopen", return_value=io.BytesIO(json.dumps(self.body).encode())) as call:
                result = RoutingService().calculate(self.points, mode)
                request = call.call_args.args[0]
                self.assertTrue(request.full_url.endswith(f"/{profile}/geojson"))
                self.assertEqual(json.loads(request.data)["coordinates"], [[106.7, 10.75], [106.71, 10.76]])
                self.assertEqual(result["routeDistanceMeters"], 1832.4)
                self.assertEqual(result["durationSeconds"], 1452.3)
                self.assertEqual(len(result["latLngs"]), 3)
                self.assertNotIn("test-key", json.dumps(result))

    def test_no_straight_line_fallback_on_provider_failure(self):
        with patch("app.services.routing_service.urlopen", side_effect=URLError("network down")):
            with self.assertRaises(HTTPException) as caught:
                RoutingService().calculate(self.points, "walking")
            self.assertEqual(caught.exception.status_code, 503)

    def test_provider_error_mapping(self):
        for upstream, expected in [(429, 429), (403, 503), (401, 503), (404, 422), (500, 502)]:
            with patch("app.services.routing_service.urlopen", side_effect=HTTPError("url", upstream, "secret provider body", {}, None)):
                with self.assertRaises(HTTPException) as caught:
                    RoutingService().calculate(self.points, "driving")
                self.assertEqual(caught.exception.status_code, expected)
                self.assertNotIn("secret", caught.exception.detail)

    def test_missing_key(self):
        with patch("app.services.routing_service.settings", SimpleNamespace(open_route_service_api_key="")):
            with self.assertRaises(HTTPException) as caught:
                RoutingService().calculate(self.points, "walking")
            self.assertEqual(caught.exception.status_code, 503)

    def test_sql_decimal_coordinates(self):
        points = [{k: Decimal(str(v)) for k, v in point.items()} for point in self.points]
        with patch("app.services.routing_service.urlopen", return_value=io.BytesIO(json.dumps(self.body).encode())):
            self.assertEqual(RoutingService().calculate(points, "walking")["routeDistanceMeters"], 1832.4)

    def test_invalid_geometry(self):
        self.body["features"][0]["geometry"]["coordinates"] = [[106, 99], [106, 10]]
        with patch("app.services.routing_service.urlopen", return_value=io.BytesIO(json.dumps(self.body).encode())):
            with self.assertRaises(HTTPException) as caught:
                RoutingService().calculate(self.points, "walking")
            self.assertEqual(caught.exception.status_code, 502)

    def test_no_route(self):
        with patch("app.services.routing_service.urlopen", return_value=io.BytesIO(b'{"features":[]}')):
            with self.assertRaises(HTTPException):
                RoutingService().calculate(self.points, "walking")

    def test_equal_points_and_invalid_mode(self):
        for points, mode in [([self.points[0]] * 2, "walking"), (self.points, "motorcycle"), ([{"latitude": None, "longitude": 0}, self.points[1]], "walking")]:
            with self.assertRaises(HTTPException) as caught:
                RoutingService().calculate(points, mode)
            self.assertEqual(caught.exception.status_code, 422)

    def test_request_validation(self):
        for points in [[{"latitude": 91, "longitude": 0}] * 2, [{"latitude": float("nan"), "longitude": 0}] * 2, [], self.points * 26]:
            with self.assertRaises(ValidationError):
                RouteRequest(points=points, mode="walking")

    def test_tour_keeps_stop_order(self):
        repo = Mock()
        repo.get_public_tour.return_value = {"pois": [{**self.points[1], "orderIndex": 2}, {**self.points[0], "orderIndex": 1}]}
        with patch.object(RoutingService, "calculate", return_value={"latLngs": []}) as calculate:
            ContentService(repo).route_tour(5, "walking")
            self.assertEqual([p["orderIndex"] for p in calculate.call_args.args[0]], [1, 2])


if __name__ == "__main__":
    unittest.main()
