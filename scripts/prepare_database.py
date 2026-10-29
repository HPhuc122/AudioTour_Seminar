"""Compatibility entry point for fresh local Vinh Khanh database setup."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

bootstrap = Path(__file__).with_name("initialize_local_database.py")
raise SystemExit(subprocess.call([sys.executable, str(bootstrap), *sys.argv[1:]]))
