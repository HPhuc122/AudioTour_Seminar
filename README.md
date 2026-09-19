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

1. Copy `.env.example` to `.env` and adjust values as needed.
2. Start the backend services with `docker compose -f infra/docker-compose.yml up --build`.

## Git

```bash
git init
git add .
git commit -m "chore: initialize AudioTour monorepo"
```
