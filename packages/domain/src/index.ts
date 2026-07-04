import type {
  Alert,
  ActivityItem,
  AiAction,
  Device,
  DeviceCommand,
  DeviceState,
  OccupancySnapshot,
  OfficeSnapshot,
  ReportRequest,
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
  getActivity(): ActivityItem[];
  getCommands(): DeviceCommand[];
  getReports(): ReportRequest[];
  getAiActions(): AiAction[];
  getStateVersion(): number;
  updateDeviceState(deviceId: string, status: "on" | "off", source: DeviceState["source"]): DeviceState | null;
  ingestDeviceTelemetry(events: DeviceTelemetryInput[]): DeviceState[];
  ingestOccupancyTelemetry(event: OccupancyTelemetryInput): OccupancySnapshot | null;
  updateAlertStatus(alertId: string, status: Alert["status"]): Alert | null;
  shutdownRoom(roomId: RoomSlug, reason: string, actor: string): DeviceCommand | null;
  shutdownOffice(reason: string, actor: string): DeviceCommand;
  createReport(format: "csv" | "pdf"): ReportRequest;
  createAiAction(tool: string, args: Record<string, unknown>, confirmationText: string): AiAction;
  updateAiAction(actionId: string, status: AiAction["status"]): AiAction | null;
}

export interface SnapshotOptions {
  currency: string;
  tariffPerKwh: number;
  timezone: string;
  publicWsUrl: string;
  platformAuthenticated: boolean;
  controlAuthorized: boolean;
}

export interface DeviceTelemetryInput {
  deviceId: string;
  status: "on" | "off" | "unknown";
  powerWatts?: number;
  observedAt?: string;
  source?: DeviceState["source"];
}

export interface OccupancyTelemetryInput {
  roomId: RoomSlug;
  motionDetected: boolean;
  observedAt?: string;
  source?: OccupancySnapshot["source"];
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
  protected readonly rooms = seedRooms();
  protected readonly devices = seedDevices();
  protected readonly deviceStates = new Map<string, DeviceState>();
  protected readonly occupancy = new Map<RoomSlug, OccupancySnapshot>();
  protected readonly alerts = new Map<string, Alert>();
  protected readonly activity: ActivityItem[] = [];
  protected readonly commands = new Map<string, DeviceCommand>();
  protected readonly reports = new Map<string, ReportRequest>();
  protected readonly aiActions = new Map<string, AiAction>();
  protected stateVersion = 1;

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
    this.addActivity("system.started", "OfficePulse in-memory backend started.", timestamp);
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

  getActivity(): ActivityItem[] {
    return this.activity.map((item) => ({ ...item })).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  getCommands(): DeviceCommand[] {
    return [...this.commands.values()].map((command) => ({ ...command }));
  }

  getReports(): ReportRequest[] {
    return [...this.reports.values()].map((report) => ({ ...report }));
  }

  getAiActions(): AiAction[] {
    return [...this.aiActions.values()].map((action) => ({ ...action, arguments: { ...action.arguments } }));
  }

  getStateVersion(): number {
    return this.stateVersion;
  }

  hydrateCurrentState(options: {
    deviceStates?: DeviceState[];
    occupancy?: OccupancySnapshot[];
    stateVersion?: number;
  }) {
    for (const state of options.deviceStates ?? []) {
      if (!this.devices.some((device) => device.id === state.deviceId)) continue;
      this.deviceStates.set(state.deviceId, { ...state });
    }
    for (const state of options.occupancy ?? []) {
      if (!this.rooms.some((room) => room.slug === state.roomId)) continue;
      this.occupancy.set(state.roomId, { ...state });
    }
    this.stateVersion = Math.max(
      this.stateVersion,
      options.stateVersion ?? 1,
      ...[...this.deviceStates.values()].map((state) => state.stateVersion)
    );
    this.refreshAlerts(new Date().toISOString());
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
    this.addActivity("device.state.changed", `${device.label} in ${this.roomName(device.roomId)} turned ${status}.`, timestamp, {
      roomId: device.roomId,
      deviceId
    });
    this.refreshAlerts(timestamp);
    return { ...next };
  }

  ingestDeviceTelemetry(events: DeviceTelemetryInput[]): DeviceState[] {
    const updated: DeviceState[] = [];
    for (const event of events) {
      const device = this.devices.find((candidate) => candidate.id === event.deviceId);
      const current = this.deviceStates.get(event.deviceId);
      if (!device || !current) continue;
      const timestamp = event.observedAt ?? new Date().toISOString();
      this.stateVersion += 1;
      const powerWatts =
        event.status === "on" ? Math.max(0, event.powerWatts ?? device.ratedWatts) : event.status === "off" ? 0 : current.powerWatts;
      const next: DeviceState = {
        ...current,
        status: event.status,
        powerWatts,
        source: event.source ?? "simulator",
        lastChangedAt: current.status === event.status ? current.lastChangedAt : timestamp,
        lastSeenAt: timestamp,
        stateVersion: this.stateVersion
      };
      this.deviceStates.set(event.deviceId, next);
      updated.push({ ...next });
      this.addActivity("telemetry.device", `Telemetry updated ${device.label} in ${this.roomName(device.roomId)}.`, timestamp, {
        roomId: device.roomId,
        deviceId: device.id,
        status: event.status,
        powerWatts
      });
    }
    this.refreshAlerts(new Date().toISOString());
    return updated;
  }

  ingestOccupancyTelemetry(event: OccupancyTelemetryInput): OccupancySnapshot | null {
    const room = this.rooms.find((candidate) => candidate.slug === event.roomId);
    if (!room) return null;
    const timestamp = event.observedAt ?? new Date().toISOString();
    const previous = this.occupancy.get(event.roomId);
    const state: OccupancySnapshot = {
      roomId: event.roomId,
      state: event.motionDetected ? "occupied" : previous?.state === "occupied" ? "recently_active" : "vacant",
      confidence: event.motionDetected ? 0.95 : 0.72,
      lastMotionAt: event.motionDetected ? timestamp : (previous?.lastMotionAt ?? null),
      source: event.source ?? "simulator",
      updatedAt: timestamp
    };
    this.stateVersion += 1;
    this.occupancy.set(event.roomId, state);
    this.addActivity(
      event.motionDetected ? "occupancy.motion.detected" : "occupancy.state.changed",
      `${room.name} occupancy is ${state.state.replace("_", " ")}.`,
      timestamp,
      { roomId: room.slug }
    );
    this.refreshAlerts(timestamp);
    return { ...state };
  }

  updateAlertStatus(alertId: string, status: Alert["status"]): Alert | null {
    const current = this.alerts.get(alertId);
    if (!current) return null;
    const timestamp = new Date().toISOString();
    const next = { ...current, status, updatedAt: timestamp };
    if (status === "resolved") {
      this.alerts.delete(alertId);
    } else {
      this.alerts.set(alertId, next);
    }
    this.stateVersion += 1;
    this.addActivity("alert.updated", `${current.title} marked ${status}.`, timestamp, {
      roomId: current.roomId,
      deviceId: current.deviceId,
      alertId
    });
    return next;
  }

  shutdownRoom(roomId: RoomSlug, reason: string, actor: string): DeviceCommand | null {
    const room = this.rooms.find((candidate) => candidate.slug === roomId);
    if (!room) return null;
    for (const device of this.devices.filter((candidate) => candidate.roomId === roomId)) {
      this.updateDeviceState(device.id, "off", "api");
    }
    return this.recordCommand({ type: "room", id: roomId }, "shutdown", reason, actor);
  }

  shutdownOffice(reason: string, actor: string): DeviceCommand {
    for (const device of this.devices) {
      this.updateDeviceState(device.id, "off", "api");
    }
    return this.recordCommand({ type: "office", id: "office-1" }, "shutdown", reason, actor);
  }

  createReport(format: "csv" | "pdf"): ReportRequest {
    const timestamp = new Date().toISOString();
    const report: ReportRequest = {
      id: `report_${crypto.randomUUID()}`,
      format,
      status: "completed",
      requestedAt: timestamp,
      completedAt: timestamp,
      downloadUrl: `/api/v1/reports/downloads/${format}/latest`
    };
    this.reports.set(report.id, report);
    this.addActivity("report.completed", `${format.toUpperCase()} report generated.`, timestamp, { reportId: report.id });
    return { ...report };
  }

  createAiAction(tool: string, args: Record<string, unknown>, confirmationText: string): AiAction {
    const timestamp = new Date().toISOString();
    const action: AiAction = {
      id: `ai_action_${crypto.randomUUID()}`,
      tool,
      status: "awaiting_confirmation",
      arguments: { ...args },
      confirmationText,
      createdAt: timestamp,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
    };
    this.aiActions.set(action.id, action);
    this.addActivity("ai.action.proposed", `AI proposed ${tool}.`, timestamp, { actionId: action.id });
    return { ...action, arguments: { ...action.arguments } };
  }

  updateAiAction(actionId: string, status: AiAction["status"]): AiAction | null {
    const current = this.aiActions.get(actionId);
    if (!current) return null;
    const next = { ...current, status };
    this.aiActions.set(actionId, next);
    this.addActivity("ai.action.updated", `AI action ${actionId} marked ${status}.`, new Date().toISOString(), { actionId });
    return { ...next, arguments: { ...next.arguments } };
  }

  private refreshAlerts(timestamp: string) {
    for (const [id, alert] of this.alerts) {
      if (alert.status === "active" && (alert.type === "all_room_devices_on_long" || alert.type === "vacant_room_devices_on")) {
        this.alerts.delete(id);
      }
    }
    for (const room of this.rooms) {
      const roomDevices = this.devices.filter((device) => device.roomId === room.slug);
      const allOn = roomDevices.every((device) => this.deviceStates.get(device.id)?.status === "on");
      if (allOn) {
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

      const occupancy = this.occupancy.get(room.slug);
      const anyOn = roomDevices.some((device) => this.deviceStates.get(device.id)?.status === "on");
      if (occupancy?.state === "vacant" && anyOn) {
        const id = `alert-${room.slug}-vacant-on`;
        this.alerts.set(id, {
          id,
          type: "vacant_room_devices_on",
          severity: "warning",
          status: "active",
          fingerprint: `vacant-room-devices-on:${room.slug}`,
          title: `${room.name} is vacant with devices on`,
          message: "Motion state is vacant while one or more devices remain on.",
          roomId: room.slug,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }
  }

  private recordCommand(
    target: DeviceCommand["target"],
    action: DeviceCommand["action"],
    reason: string,
    actor: string
  ): DeviceCommand {
    const timestamp = new Date().toISOString();
    const command: DeviceCommand = {
      id: `cmd_${crypto.randomUUID()}`,
      target,
      action,
      reason,
      actor,
      status: "succeeded",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.commands.set(command.id, command);
    this.addActivity("command.updated", `${action} command completed for ${target.type} ${target.id}.`, timestamp, { commandId: command.id });
    return { ...command };
  }

  private addActivity(
    type: string,
    message: string,
    occurredAt: string,
    context: { roomId?: RoomSlug; deviceId?: string; [key: string]: unknown } = {}
  ) {
    this.activity.unshift({
      id: `activity_${crypto.randomUUID()}`,
      type,
      message,
      roomId: context.roomId,
      deviceId: context.deviceId,
      occurredAt,
      context
    });
    if (this.activity.length > 200) this.activity.length = 200;
  }

  private roomName(roomId: RoomSlug): string {
    return this.rooms.find((room) => room.slug === roomId)?.name ?? roomId;
  }
}

export function buildUsageRankings(repository: OfficeRepository) {
  const snapshot = buildOfficeSnapshot(repository, {
    currency: "BDT",
    tariffPerKwh: 1,
    timezone: "Asia/Dhaka",
    publicWsUrl: "",
    platformAuthenticated: true,
    controlAuthorized: false
  });
  return {
    rooms: snapshot.rooms
      .map((room) => ({ roomId: room.room.slug, name: room.room.name, powerWatts: room.powerWatts }))
      .sort((a, b) => b.powerWatts - a.powerWatts),
    devices: snapshot.devices
      .map((device) => ({ deviceId: device.id, label: device.label, roomId: device.roomId, powerWatts: device.state.powerWatts }))
      .sort((a, b) => b.powerWatts - a.powerWatts)
  };
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
  return Number(devices.reduce((total, device) => total + device.state.powerWatts, 0).toFixed(2));
}
