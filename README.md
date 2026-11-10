# AudioTour

Monorepo for the AudioTour platform.

## Structure

- `apps/`: Web (React) and Mobile (React Native / Expo) applications.
- `packages/`: Shared API client, internationalization, and UI design tokens.
- `services/`: Backend microservices.
- `gateway/`: API gateway entry point.
- `infra/`: Local infrastructure configuration.
- `docs/`: Architecture and API documentation.

## Quick start

1. Install SQL Server Developer or Express locally and enable SQL Authentication on port `1433`.
2. Copy `.env.example` to `.env`; set the local SQL Server login/password.
3. Install backend dependencies and create the fresh local database/seed:

   ```powershell
   python -m pip install -r services/auth-service/requirements.txt
   python -m pip install -r services/content-service/requirements.txt
   python scripts/initialize_local_database.py
   ```

   The local demo seed creates `local-admin` plus 12 Vendor accounts (one per POI), 3 Tours, 12 unique dish illustrations, and one simulated all-POI access package (100,000 VND for 60 minutes). All local demo accounts use password `123456`; keep it only in the local test database. Non-Vietnamese translations and audio are left empty. To recreate only the new demo DB, run `python scripts/initialize_local_database.py --reset`.

   Prepared translations and 72 existing MP3 files are available in [the prepared demo package](data/prepared-demo-2026-11-10/README.md). Import the package once after creating the base seed; teammates do not need to regenerate translation or audio.

4. Start the backend and web services:

   ```powershell
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.web.yml up --build
   ```

See [the local database guide](docs/guides/local-database-bootstrap.md) for Windows Authentication, reset scope, and media behavior.

## Local Python auto-reload

`powershell -ExecutionPolicy Bypass -File scripts/start-backend.ps1` starts new
local backend services with Python auto-reload. Each service watches its own
application directory. To enable it for services already running, run the script
once with `-Restart`. Use `-Restart -NoReload` to run without auto-reload.
Changes to `.env` still require a restart. For a single service, use
`python scripts/serve.py content --reload` (or `auth`, `narration`, `gateway`).

## Git

```bash
git init
git add .
git commit -m "chore: initialize AudioTour monorepo"
```
