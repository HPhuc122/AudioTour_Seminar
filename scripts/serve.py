"""Run the existing local services with the same repository .env."""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
import uvicorn


def run_windows_reload(config):
    """Hidden Windows services cannot reliably receive Uvicorn's Ctrl+C event."""
    from uvicorn.supervisors import ChangeReload
    from uvicorn._subprocess import get_subprocess

    class WindowsReload(ChangeReload):
        def stop_worker(self):
            if self.process.is_alive():
                self.process.terminate()
            self.process.join(timeout=5)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(timeout=5)

        def restart(self):
            self.stop_worker()
            self.process = get_subprocess(config=self.config, target=self.target, sockets=self.sockets)
            self.process.start()

        def shutdown(self):
            self.should_exit.set()
            self.stop_worker()
            for sock in self.sockets:
                sock.close()

    server = uvicorn.Server(config)
    sock = config.bind_socket()
    WindowsReload(config, target=server.run, sockets=[sock]).run()

def main():
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("service", choices=["auth", "content", "narration", "gateway"])
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--reload", action="store_true", help="Reload Python app code during local development")
    args = parser.parse_args()
    directory, module, port = {
        "auth": ("services/auth-service", "app.main:app", 8001),
        "content": ("services/content-service", "app.main:app", 8002),
        "narration": ("services/narration-service", "app.main:app", 8003),
        "gateway": ("gateway", "main:app", 8000),
    }[args.service]
    sys.path.insert(0, str(root / directory))
    watch_directory = root / directory / "app" if args.service != "gateway" else root / directory
    config = uvicorn.Config(module, host=args.host, port=port, reload=args.reload,
                            reload_dirs=[str(watch_directory)] if args.reload else None,
                            timeout_graceful_shutdown=3 if args.reload else None)
    if args.reload and sys.platform == "win32":
        run_windows_reload(config)
    else:
        uvicorn.run(module, host=args.host, port=port, reload=args.reload,
                    reload_dirs=[str(watch_directory)] if args.reload else None,
                    timeout_graceful_shutdown=3 if args.reload else None)


# Windows reload workers import this module using multiprocessing.
if __name__ == "__main__":
    main()
