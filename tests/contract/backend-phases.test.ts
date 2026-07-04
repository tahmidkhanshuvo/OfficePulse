import { describe, expect, test } from "bun:test";
import { runMigrations } from "../../packages/db/src";
import { InMemoryOfficeRepository } from "../../packages/domain/src";
import { checkRedisHealth, redisKeys, redisStreams } from "../../packages/redis/src";

describe("remaining backend phase contracts", () => {
  test("ingests device telemetry and updates power", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    const [state] = repository.ingestDeviceTelemetry([
      { deviceId: "work2-fan-1", status: "on", powerWatts: 66, observedAt: "2026-07-03T09:01:00.000Z" }
    ]);

    expect(state.deviceId).toBe("work2-fan-1");
    expect(state.status).toBe("on");
    expect(state.powerWatts).toBe(66);
  });

  test("ingests occupancy telemetry and creates vacancy alert when devices remain on", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    repository.ingestOccupancyTelemetry({
      roomId: "drawing",
      motionDetected: false,
      observedAt: "2026-07-03T09:30:00.000Z"
    });
    repository.ingestOccupancyTelemetry({
      roomId: "drawing",
      motionDetected: false,
      observedAt: "2026-07-03T09:45:00.000Z"
    });

    expect(repository.getAlerts().some((alert) => alert.type === "vacant_room_devices_on")).toBe(true);
  });

  test("updates alert status and records activity", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    const alert = repository.getAlerts()[0];
    expect(alert).toBeDefined();

    const updated = repository.updateAlertStatus(alert.id, "acknowledged");

    expect(updated?.status).toBe("acknowledged");
    expect(repository.getActivity().some((item) => item.type === "alert.updated")).toBe(true);
  });

  test("snoozed alerts are suppressed while the rule remains true", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    const alert = repository.getAlerts().find((item) => item.type === "all_room_devices_on_long");
    expect(alert).toBeDefined();

    const suppressedUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const updated = repository.updateAlertStatus(alert!.id, "snoozed", { suppressedUntil });
    repository.updateDeviceState("drawing-light-1", "on", "api");

    expect(updated?.suppressedUntil).toBe(suppressedUntil);
    expect(repository.getAlerts().filter((item) => item.id === alert!.id && item.status === "active")).toHaveLength(0);
  });

  test("executes room shutdown and queues completed report", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    const command = repository.shutdownRoom("drawing", "test", "contract-test");
    const report = repository.createReport("csv");

    expect(command?.status).toBe("succeeded");
    expect(repository.getDeviceStates().filter((state) => state.deviceId.startsWith("drawing-")).every((state) => state.status === "off")).toBe(true);
    expect(report.status).toBe("completed");
  });

  test("exposes stable Redis names and dry-runs migrations without credentials", async () => {
    expect(redisKeys.deviceState("drawing-fan-1")).toBe("state:device:drawing-fan-1");
    expect(redisStreams.telemetry).toBe("stream:telemetry");

    const redisHealth = await checkRedisHealth("");
    const migrations = await runMigrations({ dryRun: true });

    expect(redisHealth.status).toBe("not_configured");
    expect(migrations.files.some((file) => file.endsWith("0001_initial_core.sql"))).toBe(true);
  });
});
