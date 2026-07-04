import type { Device, DeviceStatus } from "../../../packages/contracts/src";
import type { OfficeRepository } from "../../../packages/domain/src";

interface RunningDevice {
  startedAt: number;
  tick: number;
  timer: ReturnType<typeof setInterval>;
}

export class DeviceTelemetryGenerator {
  private readonly running = new Map<string, RunningDevice>();

  constructor(
    private readonly repository: OfficeRepository,
    private readonly intervalMs = Number(Bun.env.FAKE_DEVICE_INTERVAL_MS ?? 2500)
  ) {}

  syncDevice(deviceId: string, status: Extract<DeviceStatus, "on" | "off">) {
    if (status === "on") {
      this.start(deviceId);
    } else {
      this.stop(deviceId);
      this.repository.ingestDeviceTelemetry([
        {
          deviceId,
          status: "off",
          powerWatts: 0,
          observedAt: new Date().toISOString(),
          source: "simulator"
        }
      ]);
    }
  }

  syncRoom(roomId: string, status: Extract<DeviceStatus, "on" | "off">) {
    for (const device of this.repository.getDevices().filter((candidate) => candidate.roomId === roomId)) {
      this.syncDevice(device.id, status);
    }
  }

  syncOffice(status: Extract<DeviceStatus, "on" | "off">) {
    for (const device of this.repository.getDevices()) {
      this.syncDevice(device.id, status);
    }
  }

  warmStartFromCurrentState() {
    for (const state of this.repository.getDeviceStates()) {
      if (state.status === "on") this.start(state.deviceId);
    }
  }

  private start(deviceId: string) {
    if (this.running.has(deviceId)) return;
    const device = this.repository.getDevices().find((candidate) => candidate.id === deviceId);
    if (!device) return;

    const running: RunningDevice = {
      startedAt: Date.now(),
      tick: 0,
      timer: setInterval(() => this.emit(device), this.intervalMs)
    };
    this.running.set(deviceId, running);
    this.emit(device);
  }

  private stop(deviceId: string) {
    const current = this.running.get(deviceId);
    if (!current) return;
    clearInterval(current.timer);
    this.running.delete(deviceId);
  }

  private emit(device: Device) {
    const current = this.running.get(device.id);
    if (!current) return;
    current.tick += 1;

    const runtimeSeconds = Math.max(1, (Date.now() - current.startedAt) / 1000);
    const wave = Math.sin(runtimeSeconds / (device.type === "fan" ? 5 : 9)) * (device.type === "fan" ? 0.12 : 0.04);
    const jitter = (Math.random() - 0.5) * (device.type === "fan" ? 0.18 : 0.08);
    const warmup = device.type === "fan" ? Math.min(0.1, current.tick * 0.012) : 0;
    const powerWatts = Number(Math.max(0, device.ratedWatts * (1 + wave + jitter + warmup)).toFixed(2));

    this.repository.ingestDeviceTelemetry([
      {
        deviceId: device.id,
        status: "on",
        powerWatts,
        observedAt: new Date().toISOString(),
        source: "simulator"
      }
    ]);
  }
}
