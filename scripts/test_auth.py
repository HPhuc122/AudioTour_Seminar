import sys
import unittest
from pathlib import Path

service = Path(__file__).resolve().parents[1] / "services/auth-service"
sys.path.insert(0, str(service))
suite = unittest.defaultTestLoader.discover(str(service / "tests"))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
