"""Works with regular and embedded Python distributions."""

import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]
service = root / "services/content-service"
sys.path.insert(0, str(service))
suite = unittest.defaultTestLoader.discover(str(service / "tests"))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
