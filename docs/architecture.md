# AudioTour Architecture

AudioTour uses a monorepo layout with React web and React Native mobile clients, shared TypeScript packages, and independently deployable Python services. The Vĩnh Khánh demo uses a fresh local SQL Server database and local media files; each developer seeds their own copy from the repository.

## Services

- **auth-service**: authentication and authorization.
- **content-service**: tours, points of interest, and content metadata.
- **narration-service**: audio narration generation and delivery.
- **gateway**: public API entry point and service routing.

## Layering

Each service follows `api -> services -> repositories -> local SQL Server`. Routes validate and map requests; services own business rules; repositories are the only layer that queries or writes the database. `schemas`, `models`, and `core` hold DTOs, entities, and shared configuration.

## Data layer

Use `SQLSERVER_*` values from a local ignored `.env`; never commit credentials. Create `AudioTourVinhKhanh` with `scripts/initialize_local_database.py`, which applies the new schema-only baseline, project migrations, and Vĩnh Khánh seed. It never imports data from `apps/VinhHyAudioTourDB.sql`. Media lives under `services/content-service/uploads`; only the intentionally versioned demo assets are in Git.
