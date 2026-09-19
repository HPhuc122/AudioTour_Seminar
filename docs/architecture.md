# AudioTour Architecture

AudioTour uses a monorepo layout with React web and React Native mobile clients, shared TypeScript packages, and independently deployable Python services.

## Services

- **auth-service**: authentication and authorization.
- **content-service**: tours, points of interest, and content metadata.
- **narration-service**: audio narration generation and delivery.
- **gateway**: public API entry point and service routing.
