"""Read-only verification through the running gateway, no account required."""

import json
import urllib.request

base = "http://127.0.0.1:8000"
for path in [
    "/health",
    "/api/v1/languages?activeOnly=true",
    "/api/v1/public/pois?lang=vi&page=1&pageSize=100",
    "/api/v1/public/tours?lang=vi",
]:
    with urllib.request.urlopen(base + path, timeout=10) as response:
        body = json.load(response)
    data = body.get("data")
    if isinstance(data, dict) and "items" in data:
        print(path, "OK", "total=", data["total"])
    elif isinstance(data, list):
        print(path, "OK", "count=", len(data))
    else:
        print(path, "OK")
