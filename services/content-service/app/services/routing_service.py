import json
import math
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.core.config import settings


class RoutingService:
    PROFILES = {"walking": "foot-walking", "driving": "driving-car"}

    def calculate(self, points: list[dict], mode: str) -> dict:
        if mode not in self.PROFILES:
            raise HTTPException(422, "Chỉ hỗ trợ đi bộ hoặc ô tô.")
        if not 2 <= len(points) <= 50:
            raise HTTPException(422, "Tuyến đường cần từ 2 đến 50 điểm.")
        coordinates = []
        for point in points:
            lat, lon = point.get("latitude"), point.get("longitude")
            if (not isinstance(lat, (int, float, Decimal)) or not isinstance(lon, (int, float, Decimal))
                    or not math.isfinite(lat) or not math.isfinite(lon)
                    or not -90 <= lat <= 90 or not -180 <= lon <= 180):
                raise HTTPException(422, "Điểm dừng chưa có tọa độ hợp lệ.")
            coordinate = [float(lon), float(lat)]
            if not coordinates or coordinate != coordinates[-1]:
                coordinates.append(coordinate)
        if len(coordinates) < 2:
            raise HTTPException(422, "Điểm đi và điểm đến phải khác nhau.")
        if not settings.open_route_service_api_key:
            raise HTTPException(503, "Dịch vụ tìm đường chưa được cấu hình.")
        request = Request(
            f"https://api.heigit.org/openrouteservice/v2/directions/{self.PROFILES[mode]}/geojson",
            data=json.dumps({"coordinates": coordinates, "instructions": False}).encode(),
            headers={"Authorization": settings.open_route_service_api_key,
                     "Content-Type": "application/json", "Accept": "application/geo+json",
                     "User-Agent": "AudioTour/1.0"}, method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                body = json.load(response)
        except HTTPError as error:
            error.close()
            if error.code == 429:
                raise HTTPException(429, "Dịch vụ tìm đường đã đạt giới hạn. Vui lòng thử lại sau.") from None
            if error.code in (401, 403):
                raise HTTPException(503, "Khóa dịch vụ tìm đường chưa hợp lệ hoặc chưa được cấp quyền.") from None
            if error.code in (400, 404, 422):
                raise HTTPException(422, "Không tìm thấy tuyến phù hợp. Hãy chọn điểm gần đường hơn hoặc đổi phương tiện.") from None
            raise HTTPException(502, "Dịch vụ tìm đường đang gặp lỗi. Vui lòng thử lại.") from None
        except (URLError, TimeoutError, OSError):
            raise HTTPException(503, "Không kết nối được dịch vụ tìm đường. Vui lòng thử lại.") from None
        except (ValueError, UnicodeError):
            raise HTTPException(502, "Dịch vụ tìm đường trả dữ liệu không hợp lệ.") from None
        try:
            feature = body["features"][0]
            summary = feature["properties"]["summary"]
            geometry = feature["geometry"]
            if geometry["type"] != "LineString":
                raise ValueError()
            distance, duration = float(summary["distance"]), float(summary["duration"])
            points = [{"latitude": float(p[1]), "longitude": float(p[0])} for p in geometry["coordinates"]]
            if len(points) < 2 or not all(math.isfinite(n) and n >= 0 for n in (distance, duration)):
                raise ValueError()
            if not all(math.isfinite(p["latitude"]) and math.isfinite(p["longitude"]) and -90 <= p["latitude"] <= 90 and -180 <= p["longitude"] <= 180 for p in points):
                raise ValueError()
        except (KeyError, IndexError, TypeError, ValueError, OverflowError):
            raise HTTPException(502, "Dịch vụ tìm đường trả dữ liệu không hợp lệ.") from None
        return {"mode": mode, "routeDistanceMeters": distance, "durationSeconds": duration,
                "latLngs": points, "attribution": "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors"}
