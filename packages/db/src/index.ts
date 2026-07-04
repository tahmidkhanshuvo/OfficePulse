import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ActivityItem,
  Device,
  DeviceState,
  OccupancySnapshot,
  ReportRequest,
  Room
} from "../../contracts/src";
import {
  buildOfficeSnapshot,
  InMemoryOfficeRepository,
  seedDevices,
  seedRooms,
  type DeviceTelemetryInput,
  type OccupancyTelemetryInput,
  type SnapshotOptions
} from "../../domain/src";
import { redisKeys, redisStreams } from "../../redis/src";

export interface MigrationResult {
  mode: "dry-run" | "database";
  files: string[];
}

export function listMigrationFiles(migrationsDir = "database/migrations"): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => join(migrationsDir, file));
}

export async function runMigrations(options: {
  databaseUrl?: string;
  migrationsDir?: string;
  dryRun?: boolean;
}): Promise<MigrationResult> {
  const files = listMigrationFiles(options.migrationsDir);
  if (!options.databaseUrl || options.dryRun) {
    for (const file of files) readFileSync(file, "utf8");
    return { mode: "dry-run", files };
  }

  const { SQL } = await import("bun");
  const sql = new SQL(options.databaseUrl);
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  for (const file of files) {
    const rows = await sql`SELECT filename FROM schema_migrations WHERE filename = ${file}`;
    if (rows.length > 0) continue;
    await sql.unsafe(readFileSync(file, "utf8"));
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
  }

  await sql.close();
  return { mode: "database", files };
}

type SqlClient = InstanceType<typeof import("bun").SQL>;
type RedisClient = InstanceType<typeof Bun.RedisClient>;

interface PersistenceOptions {
  databaseUrl?: string;
  redisUrl?: string;
  migrationsDir?: string;
  snapshotOptions: SnapshotOptions;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
  };
}

interface HydratedState {
  deviceStates: DeviceState[];
  occupancy: OccupancySnapshot[];
  activity: ActivityItem[];
  stateVersion: number;
}

interface PersistedDeviceStateRow {
  device_id: string;
  status: DeviceState["status"];
  power_watts: string | number;
  source: DeviceState["source"];
  last_changed_at: Date | string;
  last_seen_at: Date | string;
  state_version: string | number;
}

interface PersistedOccupancyRow {
  room_id: OccupancySnapshot["roomId"];
  state: OccupancySnapshot["state"];
  confidence: string | number;
  last_motion_at: Date | string | null;
  source: OccupancySnapshot["source"];
  updated_at: Date | string;
}

interface PersistedTelemetryRow {
  device_id: string;
  status: DeviceState["status"];
  power_watts: string | number;
  source: DeviceState["source"];
  observed_at: Date | string;
}

interface PersistedActivityRow {
  id: string;
  type: string;
  message: string;
  room_id: string | null;
  device_id: string | null;
  context: Record<string, unknown>;
  occurred_at: Date | string;
}

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export class PersistentOfficeRepository extends InMemoryOfficeRepository {
  private readonly persistence: OfficePersistence;
  private snapshotPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly snapshotPersistIntervalMs = Number(Bun.env.SNAPSHOT_PERSIST_INTERVAL_MS ?? 5000);

  constructor(persistence: OfficePersistence) {
    super();
    this.persistence = persistence;
  }

  async hydrate() {
    const state = await this.persistence.load();
    this.hydrateCurrentState(state);
    await this.persistSnapshotNow();
  }

  override updateDeviceState(deviceId: string, status: "on" | "off", source: DeviceState["source"]) {
    const state = super.updateDeviceState(deviceId, status, source);
    if (state) {
      this.persistence.persistDeviceStates([state], true);
      this.persistSnapshotNow();
    }
    return state;
  }

  override ingestDeviceTelemetry(events: DeviceTelemetryInput[]) {
    const updated = super.ingestDeviceTelemetry(events);
    if (updated.length > 0) {
      this.persistence.persistDeviceStates(updated, true);
      this.scheduleSnapshotPersist();
    }
    return updated;
  }

  override ingestOccupancyTelemetry(event: OccupancyTelemetryInput) {
    const occupancy = super.ingestOccupancyTelemetry(event);
    if (occupancy) {
      this.persistence.persistOccupancy(occupancy, event.motionDetected);
      this.persistSnapshotNow();
    }
    return occupancy;
  }

  override createReport(format: "csv" | "pdf") {
    const report = super.createReport(format);
    this.persistence.persistReport(report);
    return report;
  }

  async getDeviceTelemetry(deviceId: string, limit = 48) {
    return this.persistence.getDeviceTelemetry(deviceId, limit);
  }

  async getDeviceUsageToday(deviceId: string) {
    return this.persistence.getDeviceUsageToday(deviceId);
  }

  async getEnergyHistoryPoints(limit = 48) {
    return this.persistence.getEnergyHistoryPoints(limit);
  }

  async getCurrentMonthRoomEnergy(tariffPerKwh: number) {
    return this.persistence.getCurrentMonthRoomEnergy(tariffPerKwh);
  }

  private scheduleSnapshotPersist() {
    if (this.snapshotPersistTimer) return;
    this.snapshotPersistTimer = setTimeout(() => {
      this.snapshotPersistTimer = null;
      void this.persistSnapshotNow();
    }, this.snapshotPersistIntervalMs);
  }

  private async persistSnapshotNow() {
    if (this.snapshotPersistTimer) {
      clearTimeout(this.snapshotPersistTimer);
      this.snapshotPersistTimer = null;
    }
    await this.persistence.persistSnapshot(
      buildOfficeSnapshot(this, this.persistence.snapshotOptions),
      this.getActivity().slice(0, 10)
    );
  }
}

export class OfficePersistence {
  readonly snapshotOptions: SnapshotOptions;
  private readonly databaseUrl: string;
  private readonly redisUrl: string;
  private readonly migrationsDir?: string;
  private readonly logger?: PersistenceOptions["logger"];
  private sql: SqlClient | null = null;
  private redis: RedisClient | null = null;
  private readonly persistedActivityIds = new Set<string>();

  constructor(options: PersistenceOptions) {
    this.databaseUrl = options.databaseUrl ?? "";
    this.redisUrl = options.redisUrl ?? "";
    this.migrationsDir = options.migrationsDir;
    this.snapshotOptions = options.snapshotOptions;
    this.logger = options.logger;
  }

  async connect() {
    if (this.databaseUrl) {
      const { SQL } = await import("bun");
      this.sql = new SQL(this.databaseUrl);
      await runMigrations({
        databaseUrl: this.databaseUrl,
        migrationsDir: this.migrationsDir
      });
      await this.seedCore();
    }

    if (this.redisUrl) {
      this.redis = new Bun.RedisClient(this.redisUrl);
      await this.redis.ping();
    }
  }

  async load(): Promise<HydratedState> {
    const redisHydrated = await this.loadFromRedis();
    if (redisHydrated) {
      return { ...redisHydrated, activity: await this.loadActivityFromDatabase() };
    }
    const databaseHydrated = await this.loadFromDatabase();
    if (databaseHydrated.deviceStates.length > 0 || databaseHydrated.occupancy.length > 0) {
      await this.writeCurrentStateToRedis(databaseHydrated.deviceStates, databaseHydrated.occupancy);
    }
    return databaseHydrated;
  }

  persistDeviceStates(states: DeviceState[], recordTelemetry: boolean) {
    void this.persistDeviceStatesAsync(states, recordTelemetry);
  }

  persistOccupancy(occupancy: OccupancySnapshot, motionDetected: boolean) {
    void this.persistOccupancyAsync(occupancy, motionDetected);
  }

  persistReport(report: ReportRequest) {
    void this.persistReportAsync(report);
  }

  async persistSnapshot(snapshot: ReturnType<typeof buildOfficeSnapshot>, activity: ActivityItem[]) {
    await this.persistActivityToDatabase(activity);
    if (!this.redis) return;
    try {
      await this.redis.set(redisKeys.officeSnapshot, JSON.stringify(snapshot));
      await this.redis.publish(redisStreams.realtime, JSON.stringify({ type: "office.snapshot", snapshot }));
    } catch (cause) {
      this.logger?.warn("Unable to persist office snapshot to Redis", errorContext(cause));
    }
  }

  async getDeviceTelemetry(deviceId: string, limit = 48): Promise<Array<{
    deviceId: string;
    status: DeviceState["status"];
    powerWatts: number;
    source: DeviceState["source"];
    observedAt: string;
  }>> {
    if (!this.sql) return [];
    try {
      const rows = (await this.sql`
        SELECT device_id, status, power_watts, source, observed_at
        FROM device_telemetry_events
        WHERE device_id = ${deviceId}
        ORDER BY observed_at DESC
        LIMIT ${limit}
      `) as PersistedTelemetryRow[];
      return rows
        .map((row) => ({
          deviceId: row.device_id,
          status: row.status,
          powerWatts: Number(row.power_watts),
          source: row.source,
          observedAt: toIso(row.observed_at) ?? new Date(0).toISOString()
        }))
        .reverse();
    } catch (cause) {
      this.logger?.warn("Unable to read device telemetry from database", errorContext(cause));
      return [];
    }
  }

  async getDeviceUsageToday(deviceId: string): Promise<{
    sampleCount: number;
    runtimeHours: number;
    todayKwh: number;
    averagePowerWatts: number;
  } | null> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const points = await this.getDeviceTelemetrySince(deviceId, since.toISOString());
    if (points.length === 0) return null;
    const sorted = points.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    let runtimeMs = 0;
    let wattMs = 0;
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      const start = new Date(current.observedAt).getTime();
      const end = next ? new Date(next.observedAt).getTime() : Date.now();
      const span = Math.max(0, Math.min(end - start, 5 * 60 * 1000));
      if (current.status === "on") runtimeMs += span;
      wattMs += current.powerWatts * span;
    }
    return {
      sampleCount: sorted.length,
      runtimeHours: Number((runtimeMs / 3_600_000).toFixed(2)),
      todayKwh: Number((wattMs / 3_600_000 / 1000).toFixed(4)),
      averagePowerWatts: Number((sorted.reduce((total, point) => total + point.powerWatts, 0) / sorted.length).toFixed(2))
    };
  }

  async getEnergyHistoryPoints(limit = 48): Promise<Array<{ recordedAt: string; powerWatts: number; estimatedKwh: number }>> {
    if (!this.sql) return [];
    try {
      const rows = (await this.sql`
        SELECT date_trunc('minute', observed_at) AS recorded_at, SUM(power_watts) AS power_watts
        FROM (
          SELECT DISTINCT ON (device_id, date_trunc('minute', observed_at))
            device_id,
            observed_at,
            power_watts
          FROM device_telemetry_events
          ORDER BY device_id, date_trunc('minute', observed_at), observed_at DESC
        ) latest_per_device_minute
        GROUP BY recorded_at
        ORDER BY recorded_at DESC
        LIMIT ${limit}
      `) as Array<{ recorded_at: Date | string; power_watts: string | number }>;
      return rows
        .map((row) => {
          const powerWatts = Number(row.power_watts);
          return {
            recordedAt: toIso(row.recorded_at) ?? new Date(0).toISOString(),
            powerWatts,
            estimatedKwh: Number((powerWatts / 1000 / 60).toFixed(5))
          };
        })
        .reverse();
    } catch (cause) {
      this.logger?.warn("Unable to read energy telemetry history from database", errorContext(cause));
      return [];
    }
  }

  async getCurrentMonthRoomEnergy(tariffPerKwh: number): Promise<Array<{
    roomId: Room["slug"];
    roomName: string;
    energyKwh: number;
    cost: number;
    currencyTariff: number;
  }>> {
    if (!this.sql) return [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    try {
      const rows = (await this.sql`
        SELECT device_id, status, power_watts, source, observed_at
        FROM device_telemetry_events
        WHERE observed_at >= ${monthStart.toISOString()}
        ORDER BY device_id ASC, observed_at ASC
      `) as PersistedTelemetryRow[];
      const devices = seedDevices();
      const rooms = new Map(seedRooms().map((room) => [room.slug, room]));
      const devicesById = new Map(devices.map((device) => [device.id, device]));
      const rowsByDevice = new Map<string, PersistedTelemetryRow[]>();
      for (const row of rows) {
        rowsByDevice.set(row.device_id, [...(rowsByDevice.get(row.device_id) ?? []), row]);
      }

      const kwhByRoom = new Map<Room["slug"], number>();
      for (const [deviceId, points] of rowsByDevice) {
        const device = devicesById.get(deviceId);
        if (!device) continue;
        let wattMs = 0;
        for (let index = 0; index < points.length; index += 1) {
          const current = points[index];
          const next = points[index + 1];
          const start = new Date(current.observed_at).getTime();
          const end = next ? new Date(next.observed_at).getTime() : Date.now();
          const span = Math.max(0, Math.min(end - start, 5 * 60 * 1000));
          wattMs += Number(current.power_watts) * span;
        }
        const kwh = wattMs / 3_600_000 / 1000;
        kwhByRoom.set(device.roomId, (kwhByRoom.get(device.roomId) ?? 0) + kwh);
      }

      return [...rooms.values()].map((room) => {
        const energyKwh = Number((kwhByRoom.get(room.slug) ?? 0).toFixed(4));
        return {
          roomId: room.slug,
          roomName: room.name,
          energyKwh,
          cost: Number((energyKwh * tariffPerKwh).toFixed(2)),
          currencyTariff: tariffPerKwh
        };
      });
    } catch (cause) {
      this.logger?.warn("Unable to read month-to-date room energy from database", errorContext(cause));
      return [];
    }
  }

  private async loadFromRedis(): Promise<HydratedState | null> {
    if (!this.redis) return null;
    try {
      const devices = await Promise.all(seedDevices().map((device) => this.redis?.get(redisKeys.deviceState(device.id))));
      const occupancy = await Promise.all(seedRooms().map((room) => this.redis?.get(redisKeys.occupancyState(room.slug))));
      const deviceStates = devices
        .filter((value): value is string => Boolean(value))
        .map((value) => JSON.parse(value) as DeviceState);
      const occupancyStates = occupancy
        .filter((value): value is string => Boolean(value))
        .map((value) => JSON.parse(value) as OccupancySnapshot);
      if (deviceStates.length === 0 && occupancyStates.length === 0) return null;
      return {
        deviceStates,
        occupancy: occupancyStates,
        activity: [],
        stateVersion: Math.max(1, ...deviceStates.map((state) => state.stateVersion))
      };
    } catch (cause) {
      this.logger?.warn("Unable to hydrate office state from Redis", errorContext(cause));
      return null;
    }
  }

  private async getDeviceTelemetrySince(deviceId: string, since: string) {
    if (!this.sql) return [];
    try {
      const rows = (await this.sql`
        SELECT device_id, status, power_watts, source, observed_at
        FROM device_telemetry_events
        WHERE device_id = ${deviceId} AND observed_at >= ${since}
        ORDER BY observed_at ASC
      `) as PersistedTelemetryRow[];
      return rows.map((row) => ({
        deviceId: row.device_id,
        status: row.status,
        powerWatts: Number(row.power_watts),
        source: row.source,
        observedAt: toIso(row.observed_at) ?? new Date(0).toISOString()
      }));
    } catch (cause) {
      this.logger?.warn("Unable to read device telemetry range from database", errorContext(cause));
      return [];
    }
  }

  private async loadFromDatabase(): Promise<HydratedState> {
    if (!this.sql) return { deviceStates: [], occupancy: [], activity: [], stateVersion: 1 };
    const deviceRows = (await this.sql`
      SELECT device_id, status, power_watts, source, last_changed_at, last_seen_at, state_version
      FROM device_state_current
    `) as PersistedDeviceStateRow[];
    const occupancyRows = (await this.sql`
      SELECT room_id, state, confidence, last_motion_at, source, updated_at
      FROM occupancy_state_current
    `) as PersistedOccupancyRow[];
    const deviceStates = deviceRows.map((row) => ({
      deviceId: row.device_id,
      status: row.status,
      powerWatts: Number(row.power_watts),
      source: row.source,
      lastChangedAt: toIso(row.last_changed_at) ?? new Date(0).toISOString(),
      lastSeenAt: toIso(row.last_seen_at) ?? new Date(0).toISOString(),
      stateVersion: Number(row.state_version)
    }));
    const occupancy = occupancyRows.map((row) => ({
      roomId: row.room_id,
      state: row.state,
      confidence: Number(row.confidence),
      lastMotionAt: toIso(row.last_motion_at),
      source: row.source,
      updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString()
    }));
    return {
      deviceStates,
      occupancy,
      activity: await this.loadActivityFromDatabase(),
      stateVersion: Math.max(1, ...deviceStates.map((state) => state.stateVersion))
    };
  }

  private async loadActivityFromDatabase(): Promise<ActivityItem[]> {
    if (!this.sql) return [];
    try {
      const rows = (await this.sql`
        SELECT id, type, message, room_id, device_id, context, occurred_at
        FROM activity_events
        ORDER BY occurred_at DESC
        LIMIT 200
      `) as PersistedActivityRow[];
      const activity = rows.map((row) => ({
        id: row.id,
        type: row.type,
        message: row.message,
        roomId: row.room_id ? (row.room_id as never) : undefined,
        deviceId: row.device_id ?? undefined,
        occurredAt: toIso(row.occurred_at) ?? new Date(0).toISOString(),
        context: row.context ?? {}
      }));
      for (const item of activity) this.persistedActivityIds.add(item.id);
      return activity;
    } catch (cause) {
      this.logger?.warn("Unable to read activity from database", errorContext(cause));
      return [];
    }
  }

  private async seedCore() {
    if (!this.sql) return;
    const rooms = seedRooms();
    const devices = seedDevices();
    const now = new Date().toISOString();

    for (const room of rooms) {
      await this.upsertRoom(room);
    }
    for (const device of devices) {
      await this.upsertDevice(device);
    }
    for (const device of devices) {
      const onByDefault = device.roomId !== "work2" || device.type === "light";
      await this.sql`
        INSERT INTO device_state_current (device_id, status, power_watts, source, last_changed_at, last_seen_at, state_version)
        VALUES (${device.id}, ${onByDefault ? "on" : "off"}, ${onByDefault ? device.ratedWatts : 0}, 'seed', ${now}, ${now}, 1)
        ON CONFLICT (device_id) DO NOTHING
      `;
    }
    for (const room of rooms) {
      const state = room.slug === "work2" ? "recently_active" : "occupied";
      const confidence = room.slug === "work2" ? 0.68 : 0.92;
      await this.sql`
        INSERT INTO occupancy_state_current (room_id, state, confidence, last_motion_at, source, updated_at)
        VALUES (${room.slug}, ${state}, ${confidence}, ${now}, 'seed', ${now})
        ON CONFLICT (room_id) DO NOTHING
      `;
    }
  }

  private async upsertRoom(room: Room) {
    if (!this.sql) return;
    await this.sql`
      INSERT INTO rooms (id, slug, name, display_order, timezone, office_open_time, office_close_time, occupancy_timeout_seconds, peak_power_watts)
      VALUES (${room.id}, ${room.slug}, ${room.name}, ${room.displayOrder}, ${room.timezone}, ${room.officeOpenTime}, ${room.officeCloseTime}, ${room.occupancyTimeoutSeconds}, ${room.peakPowerWatts})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        display_order = EXCLUDED.display_order,
        timezone = EXCLUDED.timezone,
        office_open_time = EXCLUDED.office_open_time,
        office_close_time = EXCLUDED.office_close_time,
        occupancy_timeout_seconds = EXCLUDED.occupancy_timeout_seconds,
        peak_power_watts = EXCLUDED.peak_power_watts,
        updated_at = now()
    `;
  }

  private async upsertDevice(device: Device) {
    if (!this.sql) return;
    await this.sql`
      INSERT INTO devices (id, room_id, type, label, rated_watts, hardware_channel, essential)
      VALUES (${device.id}, ${device.roomId}, ${device.type}, ${device.label}, ${device.ratedWatts}, ${device.hardwareChannel}, ${device.essential})
      ON CONFLICT (id) DO UPDATE SET
        room_id = EXCLUDED.room_id,
        type = EXCLUDED.type,
        label = EXCLUDED.label,
        rated_watts = EXCLUDED.rated_watts,
        hardware_channel = EXCLUDED.hardware_channel,
        essential = EXCLUDED.essential,
        updated_at = now()
    `;
  }

  private async persistDeviceStatesAsync(states: DeviceState[], recordTelemetry: boolean) {
    await Promise.all([
      this.persistDeviceStatesToDatabase(states, recordTelemetry),
      this.persistDeviceStatesToRedis(states)
    ]);
  }

  private async persistDeviceStatesToDatabase(states: DeviceState[], recordTelemetry: boolean) {
    if (!this.sql) return;
    try {
      for (const state of states) {
        await this.sql`
          INSERT INTO device_state_current (device_id, status, power_watts, source, last_changed_at, last_seen_at, state_version)
          VALUES (${state.deviceId}, ${state.status}, ${state.powerWatts}, ${state.source}, ${state.lastChangedAt}, ${state.lastSeenAt}, ${state.stateVersion})
          ON CONFLICT (device_id) DO UPDATE SET
            status = EXCLUDED.status,
            power_watts = EXCLUDED.power_watts,
            source = EXCLUDED.source,
            last_changed_at = EXCLUDED.last_changed_at,
            last_seen_at = EXCLUDED.last_seen_at,
            state_version = EXCLUDED.state_version
        `;
        if (recordTelemetry) {
          await this.sql`
            INSERT INTO device_telemetry_events (id, device_id, status, power_watts, source, observed_at)
            VALUES (${`device_event_${crypto.randomUUID()}`}, ${state.deviceId}, ${state.status}, ${state.powerWatts}, ${state.source}, ${state.lastSeenAt})
          `;
        }
      }
    } catch (cause) {
      this.logger?.warn("Unable to persist device state to database", errorContext(cause));
    }
  }

  private async persistDeviceStatesToRedis(states: DeviceState[]) {
    if (!this.redis) return;
    try {
      for (const state of states) {
        await this.redis.set(redisKeys.deviceState(state.deviceId), JSON.stringify(state));
        await this.redis.publish(redisStreams.telemetry, JSON.stringify({ type: "device", state }));
      }
    } catch (cause) {
      this.logger?.warn("Unable to persist device state to Redis", errorContext(cause));
    }
  }

  private async persistOccupancyAsync(occupancy: OccupancySnapshot, motionDetected: boolean) {
    await Promise.all([
      this.persistOccupancyToDatabase(occupancy, motionDetected),
      this.persistOccupancyToRedis(occupancy)
    ]);
  }

  private async persistOccupancyToDatabase(occupancy: OccupancySnapshot, motionDetected: boolean) {
    if (!this.sql) return;
    try {
      await this.sql`
        INSERT INTO occupancy_state_current (room_id, state, confidence, last_motion_at, source, updated_at)
        VALUES (${occupancy.roomId}, ${occupancy.state}, ${occupancy.confidence}, ${occupancy.lastMotionAt}, ${occupancy.source}, ${occupancy.updatedAt})
        ON CONFLICT (room_id) DO UPDATE SET
          state = EXCLUDED.state,
          confidence = EXCLUDED.confidence,
          last_motion_at = EXCLUDED.last_motion_at,
          source = EXCLUDED.source,
          updated_at = EXCLUDED.updated_at
      `;
      await this.sql`
        INSERT INTO occupancy_telemetry_events (id, room_id, state, confidence, motion_detected, source, observed_at)
        VALUES (${`occupancy_event_${crypto.randomUUID()}`}, ${occupancy.roomId}, ${occupancy.state}, ${occupancy.confidence}, ${motionDetected}, ${occupancy.source}, ${occupancy.updatedAt})
      `;
    } catch (cause) {
      this.logger?.warn("Unable to persist occupancy to database", errorContext(cause));
    }
  }

  private async persistOccupancyToRedis(occupancy: OccupancySnapshot) {
    if (!this.redis) return;
    try {
      await this.redis.set(redisKeys.occupancyState(occupancy.roomId), JSON.stringify(occupancy));
      await this.redis.publish(redisStreams.telemetry, JSON.stringify({ type: "occupancy", occupancy }));
    } catch (cause) {
      this.logger?.warn("Unable to persist occupancy to Redis", errorContext(cause));
    }
  }

  private async persistReportAsync(report: ReportRequest) {
    if (!this.sql) return;
    try {
      await this.sql`
        INSERT INTO reports (id, format, status, requested_at, completed_at, download_url)
        VALUES (${report.id}, ${report.format}, ${report.status}, ${report.requestedAt}, ${report.completedAt}, ${report.downloadUrl})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          download_url = EXCLUDED.download_url
      `;
    } catch (cause) {
      this.logger?.warn("Unable to persist report to database", errorContext(cause));
    }
  }

  private async persistActivityToDatabase(activity: ActivityItem[]) {
    if (!this.sql || activity.length === 0) return;
    try {
      for (const item of activity) {
        if (this.persistedActivityIds.has(item.id)) continue;
        await this.sql`
          INSERT INTO activity_events (id, type, message, room_id, device_id, context, occurred_at)
          VALUES (${item.id}, ${item.type}, ${item.message}, ${item.roomId ?? null}, ${item.deviceId ?? null}, ${JSON.stringify(item.context ?? {})}::jsonb, ${item.occurredAt})
          ON CONFLICT (id) DO NOTHING
        `;
        this.persistedActivityIds.add(item.id);
      }
    } catch (cause) {
      this.logger?.warn("Unable to persist activity to database", errorContext(cause));
    }
  }

  private async writeCurrentStateToRedis(deviceStates: DeviceState[], occupancy: OccupancySnapshot[]) {
    if (!this.redis) return;
    await Promise.all([this.persistDeviceStatesToRedis(deviceStates), ...occupancy.map((state) => this.persistOccupancyToRedis(state))]);
  }
}

export async function createPersistentOfficeRepository(options: PersistenceOptions): Promise<PersistentOfficeRepository> {
  const persistence = new OfficePersistence(options);
  const repository = new PersistentOfficeRepository(persistence);
  try {
    await persistence.connect();
    await repository.hydrate();
    options.logger?.info("Office persistence initialized", {
      database: Boolean(options.databaseUrl),
      redis: Boolean(options.redisUrl)
    });
  } catch (cause) {
    options.logger?.error("Office persistence unavailable; continuing with in-memory state", errorContext(cause));
  }
  return repository;
}

function errorContext(cause: unknown): Record<string, unknown> {
  return { error: cause instanceof Error ? cause.message : String(cause) };
}
