import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock

from fastapi import HTTPException
from pydantic import ValidationError

from app.api.public import TargetAccessRequest
from app.services.content_service import ContentService


class TargetAccessTests(unittest.TestCase):
    def setUp(self):
        self.repo = Mock()
        self.service = ContentService(self.repo)
        self.repo.get_public_poi.return_value = {"id": 12}
        self.repo.get_public_tour.return_value = {"id": 5}

    def test_free_target_issues_scoped_pass(self):
        self.repo.get_target_qr.return_value = {"code": "FREE", "requiresPayment": False}
        self.repo.get_qr_by_code.return_value = {"id": 3, "poiId": 12, "requiresPayment": False, "accessDurationMinutes": 30}
        result = self.service.start_target_access("poi", 12)
        self.assertFalse(result["requiresPayment"])
        self.assertTrue(result["accessToken"])
        self.assertEqual(self.repo.create_guest_pass.call_args.args[0], 3)
        self.assertEqual(self.repo.create_guest_pass.call_args.args[6], self.service._hash_token(result["accessToken"]))
        self.repo.create_payment_session.assert_not_called()

    def test_paid_target_requires_qr_without_creating_payment(self):
        self.repo.get_target_qr.return_value = {"code": "PAID", "requiresPayment": True}
        result = self.service.start_target_access("tour", 5)
        self.assertTrue(result["requiresPayment"])
        self.assertEqual(result["status"], "RequiresQr")
        self.assertNotIn("accessToken", result)
        self.repo.create_guest_pass.assert_not_called()
        self.repo.create_payment_session.assert_not_called()

    def test_missing_configuration_does_not_grant_access(self):
        self.repo.get_target_qr.return_value = None
        with self.assertRaises(HTTPException) as caught:
            self.service.start_target_access("poi", 12)
        self.assertEqual(caught.exception.status_code, 404)
        self.repo.create_guest_pass.assert_not_called()

    def test_private_target_does_not_grant_access(self):
        self.repo.get_public_poi.return_value = None
        with self.assertRaises(HTTPException) as caught:
            self.service.start_target_access("poi", 12)
        self.assertEqual(caught.exception.status_code, 404)
        self.repo.get_target_qr.assert_not_called()

    def test_poi_pass_cannot_unlock_tour(self):
        self.service.validate_access = Mock(return_value={"isValid": True, "poiId": 12, "tourId": None})
        with self.assertRaises(HTTPException) as caught:
            self.service.get_audio_tour(5, "vi", "token")
        self.assertEqual(caught.exception.status_code, 403)

    def test_other_tour_pass_cannot_unlock_tour(self):
        self.service.validate_access = Mock(return_value={"isValid": True, "poiId": None, "tourId": 6})
        with self.assertRaises(HTTPException) as caught:
            self.service.get_audio_tour(5, "vi", "token")
        self.assertEqual(caught.exception.status_code, 403)

    def test_expired_pass_cannot_unlock_audio(self):
        self.repo.get_pass_by_token_hash.return_value = {"id": 1, "status": "Active", "expiresAt": datetime.utcnow() - timedelta(seconds=1), "poiId": 12}
        with self.assertRaises(HTTPException) as caught:
            self.service.get_audio_poi(12, "vi", "manual", "expired", None)
        self.assertEqual(caught.exception.status_code, 401)
        self.repo.expire_pass.assert_called_once_with(1)

    def test_stream_still_checks_target_scope(self):
        self.repo.get_audio_track.return_value = {"poiId": 99, "fileUrl": "uploads/audio/test.mp3"}
        self.service.validate_access = Mock(return_value={"isValid": True, "poiId": 12})
        with self.assertRaises(HTTPException) as caught:
            self.service.stream_audio_info(1, "token")
        self.assertEqual(caught.exception.status_code, 403)

    def test_request_rejects_invalid_targets(self):
        for payload in ({"targetType": "admin", "targetId": 1}, {"targetType": "poi", "targetId": 0}, {}):
            with self.assertRaises(ValidationError):
                TargetAccessRequest.model_validate(payload)


if __name__ == "__main__":
    unittest.main()
