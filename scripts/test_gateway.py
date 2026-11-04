"""Gateway contract tests using mock HTTP transport; no running services or DB writes."""
import sys
import unittest
from pathlib import Path

gateway = Path(__file__).resolve().parents[1] / 'gateway'
sys.path.insert(0, str(gateway))
suite = unittest.defaultTestLoader.discover(str(gateway / 'tests'))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
