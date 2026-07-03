export type RoomSlug = "drawing" | "work1" | "work2";
export type DeviceType = "fan" | "light";
export type DeviceStatus = "on" | "off" | "unknown";
export type OccupancyState = "occupied" | "recently_active" | "vacant" | "unknown";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "snoozed" | "resolved";
export type CommandStatus =
  | "pending"
  | "warning"
  | "confirmed"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Room {
  id: RoomSlug;
  slug: RoomSlug;
  name: string;
  displayOrder: number;
  timezone: string;
  officeOpenTime: string;
  officeCloseTime: string;
  occupancyTimeoutSeconds: number;
  peakPowerWatts: number;
}

export interface Device {
  id: string;
  roomId: RoomSlug;
  type: DeviceType;
  label: string;
  ratedWatts: number;
  hardwareChannel: string;
  essential: boolean;
}

export interface DeviceState {
  deviceId: string;
  status: DeviceStatus;
  powerWatts: number;
  source: "seed" | "simulator" | "api" | "hardware";
  lastChangedAt: string;
  lastSeenAt: string;
  stateVersion: number;
}

export interface OccupancySnapshot {
  roomId: RoomSlug;
  state: OccupancyState;
  confidence: number;
  lastMotionAt: string | null;
  source: "seed" | "simulator" | "hardware";
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  fingerprint: string;
  title: string;
  message: string;
  roomId?: RoomSlug;
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  roomId?: RoomSlug;
  deviceId?: string;
  occurredAt: string;
  context?: Record<string, unknown>;
}

export interface DeviceCommand {
  id: string;
  target: { type: "device" | "room" | "office"; id: string };
  action: "on" | "off" | "shutdown";
  status: CommandStatus;
  reason: string;
  actor: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRequest {
  id: string;
  format: "csv" | "pdf";
  status: "queued" | "completed";
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export interface AiAction {
  id: string;
  tool: string;
  status: "awaiting_confirmation" | "confirmed" | "cancelled" | "expired";
  arguments: Record<string, unknown>;
  confirmationText: string;
  expiresAt: string;
  createdAt: string;
}

export interface RoomSummary {
  room: Room;
  devices: Array<Device & { state: DeviceState }>;
  occupancy: OccupancySnapshot;
  powerWatts: number;
  activeDeviceCount: number;
  alerts: Alert[];
}

export interface OfficeSnapshot {
  rooms: RoomSummary[];
  devices: Array<Device & { state: DeviceState }>;
  occupancy: OccupancySnapshot[];
  alerts: Alert[];
  energy: {
    totalPowerWatts: number;
    todayKwh: number;
    currency: string;
    estimatedCostToday: number;
  };
  permissions: {
    platformAuthenticated: boolean;
    controlAuthorized: boolean;
  };
  realtime: {
    wsUrl: string;
    stateVersion: number;
  };
  generatedAt: string;
  stale: boolean;
}

export interface ApiMeta {
  requestId: string;
  generatedAt: string;
  stateVersion?: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export const ROOM_SLUGS: RoomSlug[] = ["drawing", "work1", "work2"];

export const CONTROL_ACTIONS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
]);
