"""Run only Vendor -> Admin -> mobile regression checks (SQL rollback)."""
import os
import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]
service = root / "services/content-service"
sys.path[:0] = [str(service), str(service / "tests")]
if os.getenv("AUDIOTOUR_SQL_TESTS") != "1":
    sys.exit("Set AUDIOTOUR_SQL_TESTS=1 to run the selected SQL rollback tests")
names = [
    "test_poi_review_history_includes_children_and_checks_scope",
    "test_vendor_lists_only_own_content_and_cannot_mutate_other",
    "test_pending_approve_reject_resubmit_preserves_public_version",
    "test_translation_and_narration_only_publish_after_review",
    "test_image_and_audio_files_are_private_until_approved",
]
suite = unittest.defaultTestLoader.loadTestsFromNames([
    "test_review_sqlserver.SqlReviewTests." + name for name in names
])
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
