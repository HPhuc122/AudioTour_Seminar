"""Opt-in integration suite against imported SQL Server; each test rolls back.

Run AUDIOTOUR_SQL_TESTS=1 python -m unittest discover -s tests -v.
Uses existing active seed users 1 (Admin), 12/13 (Vendor), never their passwords.
"""

import base64
import io
import os
import unittest
import wave
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from jose import jwt

from app.api import admin as api, admin_console, public, web
from app.core.access import actor
from app.core.config import settings
from app.core.database import get_connection
from app.main import app
from app.repositories.content_repository import ContentRepository
from app.repositories.review_repository import ReviewRepository
from app.services.content_service import ContentService
from app.services.review_service import ReviewService


@unittest.skipUnless(
    os.getenv("AUDIOTOUR_SQL_TESTS") == "1", "Opt-in SQL Server integration"
)
class SqlReviewTests(unittest.TestCase):
    @contextmanager
    def as_user(self, uid=12, role="Vendor"):
        token = actor.set({"id": uid, "role": role, "username": "integration-test"})
        try:
            yield
        finally:
            actor.reset(token)

    def headers(self, uid=12, role="Vendor"):
        token = jwt.encode(
            {
                "sub": str(uid),
                "role": role,
                "username": "integration-test",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        return {"Authorization": "Bearer " + token}

    def setUp(self):
        self.context = get_connection()
        self.connection = self.context.__enter__()
        self.repo = ReviewRepository(self.connection)
        self.service = ReviewService(self.repo)
        content = ContentRepository()
        content._fetchall = self.repo.fetchall
        content._fetchone = self.repo.fetchone
        content._execute = self.repo.execute
        content._execute_scalar = self.repo.scalar
        self.content = ContentService(content)
        self.patches = [
            patch.object(api, "service", self.service),
            patch.object(admin_console, "service", self.service),
            patch.object(web, "management_service", self.service),
            patch.object(public, "service", self.content),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)
        self.files = []
        for uid in (1, 12, 13):
            self.assertTrue(
                self.repo.scalar(
                    "SELECT COUNT(*) FROM Users WHERE Id=%s AND IsActive=1", (uid,)
                )
            )
        with self.as_user():
            self.poi = self.service.create_resource(
                "pois",
                {
                    "Code": "INTEGRATION-POI",
                    "Name": "Original public name",
                    "Latitude": 11.7,
                    "Longitude": 109.1,
                    "RadiusMeters": 50,
                    "IsActive": True,
                },
            )
        with self.as_user(13):
            self.other = self.service.create_resource(
                "pois",
                {
                    "Code": "INTEGRATION-OTHER",
                    "Name": "Other vendor",
                    "Latitude": 11.8,
                    "Longitude": 109.2,
                    "RadiusMeters": 80,
                    "IsActive": True,
                },
            )

    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches):
            p.stop()
        self.connection.rollback()
        self.context.__exit__(None, None, None)
        for file in self.files:
            if file.is_file():
                file.unlink()

    def approve(self, submission):
        r = self.client.post(
            f"/api/v1/cms/submissions/{submission}/approve",
            headers=self.headers(1, "Admin"),
        )
        self.assertEqual(r.status_code, 200, r.text)
        return r

    def test_poi_review_history_includes_children_and_checks_scope(self):
        with self.as_user():
            narration = self.service.create_resource("narrations", {
                "PoiId": self.poi["Id"], "Title": "History narration",
                "LanguageCode": "vi", "TextContent": "Pending narration",
            })
        # Child ids are unrelated to their parent POI id.
        response = self.client.get(
            f"/api/v1/cms/review-queue?poiId={self.poi['Id']}",
            headers=self.headers(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        submissions = response.json()["data"]["items"]
        self.assertIn(narration["SubmissionId"], [s["Id"] for s in submissions])
        self.assertNotIn(self.other["SubmissionId"], [s["Id"] for s in submissions])
        response = self.client.get(
            f"/api/v1/cms/review-queue?poiId={self.poi['Id']}",
            headers=self.headers(13),
        )
        self.assertEqual(response.status_code, 404)

    def test_vendor_lists_only_own_content_and_cannot_mutate_other(self):
        r = self.client.get(
            "/api/v1/pois?userId=13&pageSize=500", headers=self.headers()
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn(self.other["Id"], [p["Id"] for p in r.json()["data"]["items"]])
        for method, path in [
            ("get", f"/api/v1/pois/{self.other['Id']}"),
            ("put", f"/api/v1/pois/{self.other['Id']}"),
            ("delete", f"/api/v1/pois/{self.other['Id']}"),
        ]:
            kwargs = {"json": {"Name": "stolen"}} if method == "put" else {}
            r = getattr(self.client, method)(path, headers=self.headers(), **kwargs)
            self.assertEqual(r.status_code, 404, r.text)
        r = self.client.get(
            f"/api/v1/audio/by-poi/{self.other['Id']}", headers=self.headers()
        )
        self.assertEqual(r.status_code, 404, r.text)

    def test_vendor_cannot_approve_or_set_publication_fields(self):
        for path in [
            f"/api/v1/cms/submissions/{self.poi['SubmissionId']}/approve",
            f"/api/v1/pois/{self.poi['Id']}/approve-review",
            f"/api/v1/pois/{self.poi['Id']}/waive-payment",
        ]:
            self.assertEqual(
                self.client.post(path, headers=self.headers()).status_code, 403
            )
        for field in (
            "UserId",
            "ApprovalStatus",
            "ReviewStatus",
            "LifecycleStatus",
            "Version",
        ):
            r = self.client.put(
                f"/api/v1/pois/{self.poi['Id']}",
                headers=self.headers(),
                json={field: 1},
            )
            self.assertEqual(r.status_code, 403, r.text)

    def test_pending_approve_reject_resubmit_preserves_public_version(self):
        path = f"/api/v1/public/pois/{self.poi['Id']}"
        self.assertEqual(self.client.get(path).status_code, 404)
        invalid = self.client.put(
            f"/api/v1/pois/{self.poi['Id']}/approval-status",
            headers=self.headers(1, "Admin"),
            json={"approvalStatus": 0},
        )
        self.assertEqual(invalid.status_code, 422)
        invalid = self.client.post(
            f"/api/v1/cms/submissions/{self.poi['SubmissionId']}/reject",
            headers=self.headers(1, "Admin"),
            json={"reason": 123},
        )
        self.assertEqual(invalid.status_code, 422)
        self.approve(self.poi["SubmissionId"])
        self.assertEqual(
            self.client.get(path).json()["data"]["name"], "Original public name"
        )
        r = self.client.put(
            f"/api/v1/pois/{self.poi['Id']}",
            headers=self.headers(),
            json={"Name": "Unreviewed name"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        sid = r.json()["data"]["SubmissionId"]
        self.assertEqual(
            self.client.get(path).json()["data"]["name"], "Original public name"
        )
        r = self.client.post(
            f"/api/v1/cms/submissions/{sid}/reject",
            headers=self.headers(1, "Admin"),
            json={"reason": " "},
        )
        self.assertEqual(r.status_code, 422)
        r = self.client.post(
            f"/api/v1/cms/submissions/{sid}/reject",
            headers=self.headers(1, "Admin"),
            json={"reason": "Please correct the name"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            self.client.get(path).json()["data"]["name"], "Original public name"
        )
        r = self.client.get(f"/api/v1/pois/{self.poi['Id']}", headers=self.headers())
        self.assertEqual(r.json()["data"]["RejectionReason"], "Please correct the name")
        r = self.client.post(
            f"/api/v1/cms/pois/{self.poi['Id']}/resubmit", headers=self.headers()
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.approve(r.json()["data"]["SubmissionId"])
        self.assertEqual(
            self.client.get(path).json()["data"]["name"], "Unreviewed name"
        )
        self.assertEqual(
            self.client.post(
                f"/api/v1/cms/submissions/{sid}/approve",
                headers=self.headers(1, "Admin"),
            ).status_code,
            409,
        )

    def test_translation_and_narration_only_publish_after_review(self):
        self.approve(self.poi["SubmissionId"])
        path = f"/api/v1/public/pois/{self.poi['Id']}?lang=en"
        r = self.client.post(
            "/api/v1/poi-translations",
            headers=self.headers(),
            json={
                "POIId": self.poi["Id"],
                "LanguageCode": "en",
                "Name": "English approved name",
                "Description": "English narration",
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotEqual(
            self.client.get(path).json()["data"]["name"], "English approved name"
        )
        self.approve(r.json()["data"]["SubmissionId"])
        self.assertEqual(
            self.client.get(path).json()["data"]["name"], "English approved name"
        )
        r = self.client.post(
            "/api/v1/narrations",
            headers=self.headers(),
            json={
                "PoiId": self.poi["Id"],
                "LanguageCode": "vi",
                "Title": "Reviewed narration",
                "TextContent": "Approved story",
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotEqual(
            self.client.get(path.replace("lang=en", "lang=vi"))
            .json()["data"]
            .get("description"),
            "Approved story",
        )
        self.approve(r.json()["data"]["SubmissionId"])
        self.assertNotEqual(
            self.client.get(path.replace("lang=en", "lang=vi")).json()["data"][
                "description"
            ],
            "Approved story",
        )
        self.assertEqual(
            self.client.get(path.replace("lang=en", "lang=vi")).json()["data"]["name"],
            "Original public name",
        )
        narrative = self.client.get(
            f"/api/v1/narrations/by-poi/{self.poi['Id']}", headers=self.headers()
        ).json()["data"][0]
        r = self.client.delete(
            f"/api/v1/narrations/{narrative['Id']}", headers=self.headers()
        )
        self.assertEqual(r.status_code, 200, r.text)
        proposal = self.client.get(
            f"/api/v1/narrations/{narrative['Id']}", headers=self.headers()
        ).json()["data"]
        self.approve(proposal["SubmissionId"])
        self.assertNotEqual(
            self.client.get(path.replace("lang=en", "lang=vi"))
            .json()["data"]
            .get("description"),
            "Approved story",
        )

    def test_tour_order_and_scopes_are_reviewed(self):
        self.approve(self.poi["SubmissionId"])
        self.approve(self.other["SubmissionId"])
        r = self.client.post(
            "/api/v1/tours",
            headers=self.headers(),
            json={
                "Code": "INTEGRATION-TOUR",
                "DefaultLanguage": "vi",
                "IsActive": True,
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        tour = r.json()["data"]
        r = self.client.post(
            f"/api/v1/tours/{tour['Id']}/pois",
            headers=self.headers(),
            json={"poiId": self.other["Id"]},
        )
        self.assertEqual(r.status_code, 404, r.text)
        r = self.client.post(
            f"/api/v1/tours/{tour['Id']}/pois",
            headers=self.headers(),
            json={"poiId": self.poi["Id"], "orderIndex": 0},
        )
        self.assertEqual(r.status_code, 200, r.text)
        r = self.client.get(
            f"/api/v1/web/tours/{tour['Id']}/content", headers=self.headers()
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.approve(r.json()["data"]["tour"]["SubmissionId"])
        public_tour = self.client.get(f"/api/v1/public/tours/{tour['Id']}")
        self.assertEqual(public_tour.status_code, 200, public_tour.text)
        poi = public_tour.json()["data"]["pois"][0]
        self.assertEqual(
            (poi["id"], poi["orderIndex"], poi["radiusMeters"]), (self.poi["Id"], 0, 50)
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/tours/{tour['Id']}", headers=self.headers(13)
            ).status_code,
            404,
        )

    def test_admin_grants_scope_and_revocation_takes_effect(self):
        path = f"/api/v1/cms/grants/pois/{self.other['Id']}/12"
        self.assertEqual(self.client.put(path, headers=self.headers()).status_code, 403)
        self.assertEqual(
            self.client.put(path, headers=self.headers(1, "Admin")).status_code, 200
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/pois/{self.other['Id']}", headers=self.headers()
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.delete(path, headers=self.headers(1, "Admin")).status_code, 200
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/pois/{self.other['Id']}", headers=self.headers()
            ).status_code,
            404,
        )

    def upload(self, mime, name, content):
        r = self.client.post(
            f"/api/v1/media/upload?poiId={self.poi['Id']}",
            headers=self.headers(),
            files={"file": (name, content, mime)},
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = r.json()["data"]
        self.files.append(Path(settings.media_root) / row["RelativePath"])
        return row

    def test_image_and_audio_files_are_private_until_approved(self):
        self.approve(self.poi["SubmissionId"])
        image = self.upload(
            "image/png",
            "tiny.png",
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4WQAAAAASUVORK5CYII="
            ),
        )
        image_path = f"/api/v1/public/media/images/{image['Id']}"
        self.assertEqual(self.client.get(image_path).status_code, 404)
        self.assertEqual(
            self.client.get(
                f"/api/v1/cms/media/images/{image['Id']}/stream",
                headers=self.headers(13),
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f"/api/v1/media/{image['Id']}/approve", headers=self.headers()
            ).status_code,
            403,
        )
        self.approve(image["SubmissionId"])
        self.assertEqual(self.client.get(image_path).status_code, 200)
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(8000)
            audio.writeframes(b"\0\0" * 800)
        media = self.upload("audio/wav", "sample.wav", output.getvalue())
        r = self.client.post(
            "/api/v1/audio",
            headers=self.headers(),
            json={
                "POIId": self.poi["Id"],
                "LanguageCode": "vi",
                "Title": "Live audio",
                "AudioType": "file",
                "FileUrl": media["RelativePath"],
                "MimeType": "audio/wav",
                "IsActive": True,
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        track = r.json()["data"]
        detail = f"/api/v1/public/pois/{self.poi['Id']}"
        self.assertEqual(self.client.get(detail).json()["data"]["audioTracks"], [])
        self.assertEqual(
            self.client.post(
                f"/api/v1/cms/submissions/{track['SubmissionId']}/approve",
                headers=self.headers(1, "Admin"),
            ).status_code,
            409,
        )
        self.approve(media["SubmissionId"])
        self.approve(track["SubmissionId"])
        self.assertEqual(
            self.client.get(detail).json()["data"]["audioTracks"][0]["id"], track["Id"]
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/cms/audio-preview/{track['Id']}/stream",
                headers=self.headers(13),
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/public/audio/{track['Id']}").status_code, 401
        )
        r = self.client.post(
            "/api/v1/qr",
            headers=self.headers(),
            json={
                "Code": "INTEGRATION-FREE",
                "PoiId": self.poi["Id"],
                "IsActive": True,
                "RequiresPayment": False,
                "AccessDurationMinutes": 60,
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        access = self.client.post(
            "/api/v1/public/access/start-target",
            json={"targetType": "poi", "targetId": self.poi["Id"]},
        )
        self.assertEqual(access.status_code, 200, access.text)
        guest = {"X-Guest-Access-Token": access.json()["data"]["accessToken"]}
        stream = self.client.get(f"/api/v1/public/audio/{track['Id']}", headers=guest)
        self.assertEqual(stream.status_code, 200, stream.text)
        self.assertEqual(stream.content, output.getvalue())
        r = self.client.delete(f"/api/v1/media/{media['Id']}", headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            self.client.get(detail).json()["data"]["audioTracks"][0]["id"], track["Id"]
        )
        r = self.client.get(f"/api/v1/media/{media['Id']}", headers=self.headers())
        self.approve(r.json()["data"]["SubmissionId"])
        self.assertEqual(self.client.get(detail).json()["data"]["audioTracks"], [])
        self.assertEqual(
            self.client.get(
                f"/api/v1/public/audio/{track['Id']}", headers=guest
            ).status_code,
            404,
        )

    def test_disabled_or_demoted_account_token_is_rejected(self):
        self.repo.execute("UPDATE Users SET IsActive=0 WHERE Id=12")
        self.assertEqual(
            self.client.get("/api/v1/pois", headers=self.headers()).status_code, 401
        )

    def test_media_replacement_keeps_old_bytes_until_review(self):
        self.approve(self.poi["SubmissionId"])
        original_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4WQAAAAASUVORK5CYII="
        )
        image = self.upload("image/png", "original.png", original_bytes)
        self.approve(image["SubmissionId"])
        url = f"/api/v1/public/media/images/{image['Id']}"
        replacement = original_bytes + b"replacement"
        endpoint = f"/api/v1/media/{image['Id']}/replacement"
        r = self.client.post(
            endpoint,
            headers=self.headers(13),
            files={"file": ("new.png", replacement, "image/png")},
        )
        self.assertEqual(r.status_code, 404)
        r = self.client.post(
            endpoint,
            headers=self.headers(),
            files={"file": ("new.png", replacement, "image/png")},
        )
        self.assertEqual(r.status_code, 200, r.text)
        proposed = r.json()["data"]
        self.files.append(Path(settings.media_root) / proposed["RelativePath"])
        self.assertEqual(self.client.get(url).content, original_bytes)
        sid = proposed["SubmissionId"]
        r = self.client.post(
            f"/api/v1/cms/submissions/{sid}/reject",
            headers=self.headers(1, "Admin"),
            json={"reason": "Replace with a clearer photo"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.client.get(url).content, original_bytes)
        r = self.client.post(
            f"/api/v1/cms/media/{image['Id']}/resubmit", headers=self.headers()
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.approve(r.json()["data"]["SubmissionId"])
        self.assertEqual(self.client.get(url).content, replacement)

    def test_review_queue_does_not_leak_other_vendor(self):
        r = self.client.get("/api/v1/cms/submissions", headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn(
            self.other["SubmissionId"], [p["Id"] for p in r.json()["data"]["items"]]
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/cms/submissions/{self.other['SubmissionId']}",
                headers=self.headers(),
            ).status_code,
            404,
        )

    def test_superseded_proposal_cannot_overwrite_newer_changes(self):
        self.approve(self.poi["SubmissionId"])
        path = f"/api/v1/pois/{self.poi['Id']}"
        first = self.client.put(
            path, headers=self.headers(), json={"Name": "First"}
        ).json()["data"]
        second = self.client.put(
            path, headers=self.headers(), json={"Name": "Second"}
        ).json()["data"]
        self.assertEqual(
            self.client.post(
                f"/api/v1/cms/submissions/{first['SubmissionId']}/approve",
                headers=self.headers(1, "Admin"),
            ).status_code,
            409,
        )
        self.approve(second["SubmissionId"])
        self.assertEqual(
            self.client.get(f"/api/v1/public/pois/{self.poi['Id']}").json()["data"][
                "name"
            ],
            "Second",
        )
