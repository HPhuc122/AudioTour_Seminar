"""Read-only gateway permission probes with short-lived local test JWTs.

Uses active imported seed accounts, never prints JWTs or account data.
Password-based sign-in is not tested by this probe.
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "services/content-service"))
from app.core.config import settings
from jose import jwt


def probe(path, expected, uid=None, role=None):
    headers = {}
    if uid:
        token = jwt.encode(
            {
                "sub": str(uid),
                "role": role,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request("http://127.0.0.1:8000" + path, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            code = response.status
            body = json.load(response)
    except urllib.error.HTTPError as e:
        code = e.code
        body = None
    assert code == expected, f"{path}: expected {expected}, got {code}"
    print(path, role or "anonymous", code, "OK")
    return body


probe("/api/v1/pois", 401)
probe("/api/v1/users", 403, 12, "Vendor")
probe("/api/v1/users", 200, 1, "Admin")
probe("/api/v1/pois", 200, 12, "Vendor")
queue = probe("/api/v1/cms/submissions?status=Pending", 200, 1, "Admin")
print("Pending submissions:", queue["data"]["total"])
