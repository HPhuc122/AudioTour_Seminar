"""Only narration automation regressions, SQL rollback and provider fixtures."""
import os
import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]
service = root / 'services/content-service'
sys.path[:0] = [str(service), str(service / 'tests')]
if os.getenv('AUDIOTOUR_SQL_TESTS') != '1':
    sys.exit('Set AUDIOTOUR_SQL_TESTS=1 for selected SQL rollback tests')
names = [
    'test_atomic_approval_enqueue_snapshot_and_no_duplicates',
    'test_one_approval_publishes_each_language_with_audio',
    'test_new_version_retains_old_pair_until_success_and_fences_old_job',
    'test_failure_retry_limits_lease_recovery_and_admin_retry',
    'test_status_scope_missing_config_and_missing_file_not_advertised',
    'test_missing_configuration_is_real_failure_without_http_call',
    'test_expired_worker_is_fenced_and_exhausted_lease_fails',
    'test_new_narration_fences_older_draft_and_retry',
    'test_generated_audio_keeps_manual_upload_review_and_soft_delete_history',
    'test_provider_retry_after_is_not_shortened_by_worker_backoff',
]
suite = unittest.defaultTestLoader.loadTestsFromNames([
    'test_narration_jobs.NarrationJobsTests.' + name for name in names
])
suite.addTests(unittest.defaultTestLoader.loadTestsFromName('test_narration_provider.ProviderContractTests'))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
