CREATE TABLE IF NOT EXISTS device_telemetry_events (
  id text PRIMARY KEY,
  device_id text NOT NULL REFERENCES devices(id),
  status text NOT NULL CHECK (status IN ('on', 'off', 'unknown')),
  power_watts numeric(10, 2) NOT NULL CHECK (power_watts >= 0),
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS occupancy_telemetry_events (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id),
  state text NOT NULL CHECK (state IN ('occupied', 'recently_active', 'vacant', 'unknown')),
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  motion_detected boolean NOT NULL,
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  message text NOT NULL,
  room_id text REFERENCES rooms(id),
  device_id text REFERENCES devices(id),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  format text NOT NULL CHECK (format IN ('csv', 'pdf')),
  status text NOT NULL CHECK (status IN ('queued', 'completed')),
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  download_url text
);

CREATE INDEX IF NOT EXISTS device_telemetry_device_observed_idx
  ON device_telemetry_events (device_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS occupancy_telemetry_room_observed_idx
  ON occupancy_telemetry_events (room_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_occurred_idx
  ON activity_events (occurred_at DESC);
