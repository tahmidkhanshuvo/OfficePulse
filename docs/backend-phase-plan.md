# Backend Phase Plan

## Phase 0 - Foundation

Status: complete

- Bun API server entrypoint.
- Shared contracts for rooms, devices, occupancy, alerts, snapshots, and API envelopes.
- Typed environment configuration.
- Structured JSON logger.
- Platform PIN verification.
- Platform session and recent control re-verification stores.
- Health and readiness endpoints.
- Initial SQL schema and seed SQL.
- Backend-focused TypeScript and contract tests.

## Phase 1 - Live Monitoring API

Status: complete for in-memory local development

- Seed exactly three rooms and 15 devices.
- Serve `/api/v1/bootstrap`.
- Serve room, device, occupancy, energy, alert, activity, settings, and system component reads.
- Protect all browser-facing reads behind platform PIN session.
- Authenticate WebSocket upgrade and send initial subscription event.

## Phase 2 - Persistence and Redis

Status: adapter scaffolding complete; production Neon/Redis wiring remains

- Replace in-memory repositories with Neon-backed repositories.
- Add Redis cache/session adapters.
- Migration runner dry-runs without credentials and applies SQL when a database URL is provided.
- Add durable device state, occupancy state, alerts, and activity log writes.
- Redis key/stream contracts are defined.
- Add Redis pub/sub fan-out and state-version cache invalidation.

## Phase 3 - Telemetry and Simulator

Status: complete for local in-memory API

- Implemented `/internal/v1/telemetry/devices`.
- Implemented `/internal/v1/telemetry/occupancy`.
- Implement HMAC/service-token validation.
- Simulator CLI emits deterministic scenario event batches.
- Publish device and occupancy changes to WebSocket clients.

## Phase 4 - Alerts and Automation

Status: complete for core local behavior

- Implement after-hours detection.
- Implemented all-room-devices-on-long detection.
- Implemented vacant-room waste detection.
- Added alert acknowledgement, snooze, resolve, mute endpoint behavior.
- Added command activity records; durable audit/idempotency remains for Neon phase.

## Phase 5 - Discord and Agent Tools

Status: contract scaffolding complete

- Implement Discord `!status`, `!room`, and `!usage` using backend data.
- Added slash-command registration payload script.
- Added shared read-only and protected AI tool contracts.
- Added protected action proposal and confirmation records.

## Phase 6 - Analytics and Reports

Status: complete for demo estimates

- Implemented power/energy history placeholder.
- Implemented cost, carbon, rankings, forecast, and savings endpoints.
- Added CSV/PDF report queue contracts.
- Add hourly rollup worker jobs.

## Phase 7 - Reliability and Production Hardening

Status: partially complete

- Add rate limiting and lockout for PIN attempts.
- Add CSRF strategy for cookie-backed writes.
- Add Redis stream worker recovery.
- Add component heartbeat writes.
- Add integration/load/failure tests.
