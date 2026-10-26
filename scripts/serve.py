"""Run the existing local services with the same repository .env."""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
import uvicorn

root = Path(__file__).resolve().parents[1]
load_dotenv(root / ".env")
parser = argparse.ArgumentParser()
parser.add_argument("service", choices=["auth", "content", "narration", "gateway"])
parser.add_argument("--host", default="0.0.0.0")
args = parser.parse_args()
directory, module, port = {
    "auth": ("services/auth-service", "app.main:app", 8001),
    "content": ("services/content-service", "app.main:app", 8002),
    "narration": ("services/narration-service", "app.main:app", 8003),
    "gateway": ("gateway", "main:app", 8000),
}[args.service]
sys.path.insert(0, str(root / directory))
uvicorn.run(module, host=args.host, port=port)
