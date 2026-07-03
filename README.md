# OfficePulse

OfficePulse is a real-time office energy monitoring system for 15 devices across three rooms, built around a shared Bun backend, Neon Postgres, Redis, Discord integration, simulator telemetry, a React dashboard, and a 6-digit platform PIN gate.

This repository is scaffolded from the full system architecture document in `OfficePulse_Full_System_API_and_File_Structure_Documentation.pdf`.

## Repository Layout

- `apps/dashboard` - React + Vite PWA dashboard.
- `apps/api` - Bun HTTP and WebSocket API server.
- `apps/worker` - Redis stream consumers, alerts, automations, rollups, and reports.
- `apps/simulator` - Deterministic device and PIR telemetry simulator.
- `apps/discord-bot` - Discord Gateway, interactions, commands, and notifications.
- `packages/auth` - Platform PIN hashing, Redis-backed sessions, recent control re-verification, and cookie guards.
- `packages/contracts` - Shared API schemas, event types, and enums.
- `packages/domain` - Pure business logic and calculations.
- `packages/db` - SQL, migrations, repositories, and Neon connection handling.
- `packages/redis` - Redis keys, streams, pub/sub, locks, and cache helpers.
- `packages/agent` - AI provider adapter, tool registry, and confirmation state.
- `packages/config` - Typed environment configuration.
- `packages/logger` - Structured logging and correlation IDs.
- `packages/ui` - Shared dashboard UI components.
- `packages/testing` - Fixtures, fake clocks, and test helpers.

## First-Time Setup

1. Install Bun.
2. Copy `.env.example` to `.env` and fill the required values, including `PLATFORM_PIN_HASH` and `SESSION_COOKIE_SECRET`.
3. Run `bun install`.
4. Start Redis with `docker compose -f infra/docker-compose.yml up -d redis`.
5. Run `bun run db:migrate`.
6. Run `bun run db:seed`.
7. Run `bun run dev`.
