CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL CHECK (slug IN ('drawing', 'work1', 'work2')),
  name text NOT NULL,
  display_order integer NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  office_open_time time NOT NULL DEFAULT '09:00',
  office_close_time time NOT NULL DEFAULT '17:00',
  occupancy_timeout_seconds integer NOT NULL DEFAULT 900,
  peak_power_watts numeric(10, 2) NOT NULL DEFAULT 180,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id),
  type text NOT NULL CHECK (type IN ('fan', 'light')),
  label text NOT NULL,
  rated_watts numeric(10, 2) NOT NULL CHECK (rated_watts >= 0),
  hardware_channel text NOT NULL,
  essential boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, label)
);

CREATE TABLE IF NOT EXISTS device_state_current (
  device_id text PRIMARY KEY REFERENCES devices(id),
  status text NOT NULL CHECK (status IN ('on', 'off', 'unknown')),
  power_watts numeric(10, 2) NOT NULL CHECK (power_watts >= 0),
  source text NOT NULL,
  last_changed_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  state_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS occupancy_state_current (
  room_id text PRIMARY KEY REFERENCES rooms(id),
  state text NOT NULL CHECK (state IN ('occupied', 'recently_active', 'vacant', 'unknown')),
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  last_motion_at timestamptz,
  source text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status text NOT NULL CHECK (status IN ('active', 'acknowledged', 'snoozed', 'resolved')),
  fingerprint text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  room_id text REFERENCES rooms(id),
  device_id text REFERENCES devices(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_active_fingerprint_idx
  ON alerts (fingerprint)
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS devices_room_id_idx ON devices (room_id);
CREATE INDEX IF NOT EXISTS alerts_status_severity_created_idx ON alerts (status, severity, created_at DESC);
