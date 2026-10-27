"""Run only narration-service tests with mocked Azure HTTP; no paid requests."""
import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]
service = root / 'services/narration-service'
sys.path[:0] = [str(service), str(service / 'tests')]
suite = unittest.defaultTestLoader.loadTestsFromName('test_azure_adapter.AdapterTests')
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
