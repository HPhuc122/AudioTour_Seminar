# AudioTour Architecture

AudioTour uses a monorepo layout with React web and React Native mobile clients, shared TypeScript packages, and independently deployable Python services. Persistent server-side data is stored in Microsoft SQL Server.

## Services

- **auth-service**: authentication and authorization.
- **content-service**: tours, points of interest, and content metadata.
- **narration-service**: audio narration generation and delivery.
- **gateway**: public API entry point and service routing.

## Layering

Each service follows `api -> services -> repositories -> SQL Server`. Routes validate and map requests; services own business rules; repositories are the only layer that queries or writes the database. `schemas`, `models`, and `core` hold DTOs, entities, and shared configuration.

## Data layer

Use `SQLSERVER_*` values from `.env`; never commit a real SQL Server password. See `docs/api-contracts/legacy-api-migration.md` for legacy contract mapping.
