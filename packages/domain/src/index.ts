import type {
  Alert,
  Device,
  DeviceState,
  OccupancySnapshot,
  OfficeSnapshot,
  Room,
  RoomSlug,
  RoomSummary
} from "../../contracts/src";

export interface OfficeRepository {
  getRooms(): Room[];
  getDevices(): Device[];
  getDeviceStates(): DeviceState[];
  getOccupancy(): OccupancySnapshot[];
  getAlerts(): Alert[];
  getStateVersion(): number;
  updateDeviceState(deviceId: string, status: "on" | "off", source: DeviceState["source"]): DeviceState | null;
}

export interface SnapshotOptions {
  currency: string;
  tariffPerKwh: number;
  timezone: string;
  publicWsUrl: string;
  platformAuthenticated: boolean;
  controlAuthorized: boolean;
}

const ROOM_DEFINITIONS: Room[] = [
  {
    id: "drawing",
    slug: "drawing",
    name: "Drawing Room",
    displayOrder: 1,
    timezone: "Asia/Dhaka",
    officeOpenTime: "09:00",
    officeCloseTime: "17:00",
    occupancyTimeoutSeconds: 900,
    peakPowerWatts: 180
  },
  {
    id: "work1",
    slug: "work1",
    name: "Work Room 1",
    displayOrder: 2,
    timezone: "Asia/Dhaka",
    officeOpenTime: "09:00",
    officeCloseTime: "17:00",
    occupancyTimeoutSeconds: 900,
    peakPowerWatts: 180
  },
  {
    id: "work2",
    slug: "work2",
    name: "Work Room 2",
    displayOrder: 3,
    timezone: "Asia/Dhaka",
    officeOpenTime: "09:00",
    officeCloseTime: "17:00",
    occupancyTimeoutSeconds: 900,
    peakPowerWatts: 180
  }
];

function createRoomDevices(roomId: RoomSlug): Device[] {
  return [
    {
      id: `${roomId}-fan-1`,
      roomId,
      type: "fan",
      label: "Fan 1",
      ratedWatts: 60,
      hardwareChannel: `${roomId}:fan:1`,
      essential: false
    },
    {
      id: `${roomId}-fan-2`,
      roomId,
      type: "fan",
      label: "Fan 2",
      ratedWatts: 60,
      hardwareChannel: `${roomId}:fan:2`,
      essential: false
    },
    {
      id: `${roomId}-light-1`,
      roomId,
      type: "light",
      label: "Light 1",
      ratedWatts: 15,
      hardwareChannel: `${roomId}:light:1`,
      essential: false
    },
    {
      id: `${roomId}-light-2`,
      roomId,
      type: "light",
      label: "Light 2",
      ratedWatts: 15,
      hardwareChannel: `${roomId}:light:2`,
      essential: false
    },
    {
      id: `${roomId}-light-3`,
      roomId,
      type: "light",
      label: "Light 3",
      ratedWatts: 15,
      hardwareChannel: `${roomId}:light:3`,
      essential: false
    }
  ];
}

export const seedRooms = (): Room[] => ROOM_DEFINITIONS.map((room) => ({ ...room }));

export const seedDevices = (): Device[] => ROOM_DEFINITIONS.flatMap((room) => createRoomDevices(room.slug));

export class InMemoryOfficeRepository implements OfficeRepository {
  private readonly rooms = seedRooms();
  private readonly devices = seedDevices();
  private readonly deviceStates = new Map<string, DeviceState>();
  private readonly occupancy = new Map<RoomSlug, OccupancySnapshot>();
  private readonly alerts = new Map<string, Alert>();
  private stateVersion = 1;

  constructor(now = new Date()) {
    const timestamp = now.toISOString();
    for (const device of this.devices) {
      const onByDefault = device.roomId !== "work2" || device.type === "light";
      this.deviceStates.set(device.id, {
        deviceId: device.id,
        status: onByDefault ? "on" : "off",
        powerWatts: onByDefault ? device.ratedWatts : 0,
        source: "seed",
        lastChangedAt: timestamp,
        lastSeenAt: timestamp,
        stateVersion: this.stateVersion
      });
    }

    for (const room of this.rooms) {
      this.occupancy.set(room.slug, {
        roomId: room.slug,
        state: room.slug === "work2" ? "recently_active" : "occupied",
        confidence: room.slug === "work2" ? 0.68 : 0.92,
        lastMotionAt: timestamp,
        source: "seed",
        updatedAt: timestamp
      });
    }

    this.refreshAlerts(timestamp);
  }

  getRooms(): Room[] {
    return this.rooms.map((room) => ({ ...room }));
  }

  getDevices(): Device[] {
    return this.devices.map((device) => ({ ...device }));
  }

  getDeviceStates(): DeviceState[] {
    return [...this.deviceStates.values()].map((state) => ({ ...state }));
  }

  getOccupancy(): OccupancySnapshot[] {
    return [...this.occupancy.values()].map((state) => ({ ...state }));
  }

  getAlerts(): Alert[] {
    return [...this.alerts.values()].map((alert) => ({ ...alert }));
  }

  getStateVersion(): number {
    return this.stateVersion;
  }

  updateDeviceState(deviceId: string, status: "on" | "off", source: DeviceState["source"]): DeviceState | null {
    const device = this.devices.find((candidate) => candidate.id === deviceId);
    const current = this.deviceStates.get(deviceId);
    if (!device || !current) return null;

    const timestamp = new Date().toISOString();
    this.stateVersion += 1;
    const next: DeviceState = {
      ...current,
      status,
      powerWatts: status === "on" ? device.ratedWatts : 0,
      source,
      lastChangedAt: current.status === status ? current.lastChangedAt : timestamp,
      lastSeenAt: timestamp,
      stateVersion: this.stateVersion
    };
    this.deviceStates.set(deviceId, next);
    this.refreshAlerts(timestamp);
    return { ...next };
  }

  private refreshAlerts(timestamp: string) {
    this.alerts.clear();
    for (const room of this.rooms) {
      const roomDevices = this.devices.filter((device) => device.roomId === room.slug);
      const allOn = roomDevices.every((device) => this.deviceStates.get(device.id)?.status === "on");
      if (!allOn) continue;
      const id = `alert-${room.slug}-all-on`;
      this.alerts.set(id, {
        id,
        type: "all_room_devices_on_long",
        severity: "warning",
        status: "active",
        fingerprint: `all-room-devices-on:${room.slug}`,
        title: `${room.name} has all devices on`,
        message: "All five devices are on. Verify whether this room still needs full power.",
        roomId: room.slug,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  }
}

export function buildOfficeSnapshot(repository: OfficeRepository, options: SnapshotOptions): OfficeSnapshot {
  const rooms = repository.getRooms();
  const devices = repository.getDevices();
  const states = new Map(repository.getDeviceStates().map((state) => [state.deviceId, state]));
  const occupancy = repository.getOccupancy();
  const occupancyByRoom = new Map(occupancy.map((state) => [state.roomId, state]));
  const alerts = repository.getAlerts();
  const alertsByRoom = new Map<RoomSlug, Alert[]>();

  for (const alert of alerts) {
    if (!alert.roomId) continue;
    alertsByRoom.set(alert.roomId, [...(alertsByRoom.get(alert.roomId) ?? []), alert]);
  }

  const devicesWithState = devices.map((device) => ({
    ...device,
    state: states.get(device.id) ?? {
      deviceId: device.id,
      status: "unknown" as const,
      powerWatts: 0,
      source: "seed" as const,
      lastChangedAt: new Date(0).toISOString(),
      lastSeenAt: new Date(0).toISOString(),
      stateVersion: repository.getStateVersion()
    }
  }));

  const roomSummaries: RoomSummary[] = rooms
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((room) => {
      const roomDevices = devicesWithState.filter((device) => device.roomId === room.slug);
      return {
        room,
        devices: roomDevices,
        occupancy: occupancyByRoom.get(room.slug) ?? {
          roomId: room.slug,
          state: "unknown",
          confidence: 0,
          lastMotionAt: null,
          source: "seed",
          updatedAt: new Date(0).toISOString()
        },
        powerWatts: sumPower(roomDevices),
        activeDeviceCount: roomDevices.filter((device) => device.state.status === "on").length,
        alerts: alertsByRoom.get(room.slug) ?? []
      };
    });

  const totalPowerWatts = sumPower(devicesWithState);
  const todayKwh = Number(((totalPowerWatts * 8) / 1000).toFixed(3));
  return {
    rooms: roomSummaries,
    devices: devicesWithState,
    occupancy,
    alerts,
    energy: {
      totalPowerWatts,
      todayKwh,
      currency: options.currency,
      estimatedCostToday: Number((todayKwh * options.tariffPerKwh).toFixed(2))
    },
    permissions: {
      platformAuthenticated: options.platformAuthenticated,
      controlAuthorized: options.controlAuthorized
    },
    realtime: {
      wsUrl: options.publicWsUrl,
      stateVersion: repository.getStateVersion()
    },
    generatedAt: new Date().toISOString(),
    stale: false
  };
}

function sumPower(devices: Array<{ state: DeviceState }>): number {
  return devices.reduce((total, device) => total + device.state.powerWatts, 0);
}
