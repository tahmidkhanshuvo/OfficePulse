import { describe, expect, test } from "bun:test";
import { buildOfficeSnapshot, InMemoryOfficeRepository, seedDevices, seedRooms } from "../../packages/domain/src";

describe("OfficePulse seed data", () => {
  test("creates exactly three rooms and fifteen devices", () => {
    const rooms = seedRooms();
    const devices = seedDevices();

    expect(rooms).toHaveLength(3);
    expect(devices).toHaveLength(15);
    expect(devices.filter((device) => device.type === "fan")).toHaveLength(6);
    expect(devices.filter((device) => device.type === "light")).toHaveLength(9);
  });
});

describe("office snapshot", () => {
  test("computes office and room power from current device states", () => {
    const repository = new InMemoryOfficeRepository(new Date("2026-07-03T09:00:00.000Z"));
    const snapshot = buildOfficeSnapshot(repository, {
      currency: "BDT",
      tariffPerKwh: 12,
      timezone: "Asia/Dhaka",
      publicWsUrl: "ws://localhost:3000/ws",
      platformAuthenticated: true,
      controlAuthorized: false
    });

    expect(snapshot.rooms).toHaveLength(3);
    expect(snapshot.devices).toHaveLength(15);
    expect(snapshot.energy.totalPowerWatts).toBe(
      snapshot.devices.reduce((total, device) => total + device.state.powerWatts, 0)
    );
    expect(snapshot.rooms.map((room) => room.devices.length)).toEqual([5, 5, 5]);
  });
});
