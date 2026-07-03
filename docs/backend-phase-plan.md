# Backend Phase Plan

## Phase 0 - Foundation

Status: started

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

Status: started

- Seed exactly three rooms and 15 devices.
- Serve `/api/v1/bootstrap`.
- Serve room, device, occupancy, energy, alert, activity, settings, and system component reads.
- Protect all browser-facing reads behind platform PIN session.
- Authenticate WebSocket upgrade and send initial subscription event.

## Phase 2 - Persistence and Redis

Status: next

- Replace in-memory repositories with Neon-backed repositories.
- Add Redis cache/session adapters.
- Add migration runner.
- Add durable device state, occupancy state, alerts, and activity log writes.
- Add Redis pub/sub fan-out and state-version cache invalidation.

## Phase 3 - Telemetry and Simulator

Status: pending

- Implement `/internal/v1/telemetry/devices`.
- Implement `/internal/v1/telemetry/occupancy`.
- Implement HMAC/service-token validation.
- Implement deterministic simulator scenarios.
- Publish device and occupancy changes to WebSocket clients.

## Phase 4 - Alerts and Automation

Status: pending

- Implement after-hours detection.
- Implement all-room-devices-on-long detection.
- Implement vacant-room waste detection.
- Add alert acknowledgement, snooze, resolve, mute, and dedupe.
- Add command audit records and idempotency handling.

## Phase 5 - Discord and Agent Tools

Status: pending

- Implement Discord `!status`, `!room`, and `!usage` using backend data.
- Add slash-command registration script.
- Add shared read-only AI tool contracts.
- Add protected action proposal and confirmation records.

## Phase 6 - Analytics and Reports

Status: pending

- Implement power/energy history.
- Implement cost, waste, carbon, rankings, and savings endpoints.
- Add CSV/PDF report queue contracts.
- Add hourly rollup worker jobs.

## Phase 7 - Reliability and Production Hardening

Status: pending

- Add rate limiting and lockout for PIN attempts.
- Add CSRF strategy for cookie-backed writes.
- Add Redis stream worker recovery.
- Add component heartbeat writes.
- Add integration/load/failure tests.
