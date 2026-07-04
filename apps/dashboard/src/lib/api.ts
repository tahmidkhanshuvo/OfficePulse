import type {
  ActivityItem,
  Alert,
  ApiEnvelope,
  Device,
  DeviceState,
  OfficeSnapshot,
  ReportRequest,
  RoomSlug,
} from "../../../../packages/contracts/src";

export type DeviceWithState = Device & { state: DeviceState };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function defaultBaseUrl(): string {
  const viteUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_PUBLIC_API_URL;
  if (viteUrl) return String(viteUrl).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://localhost:3000";
  }
  return "";
}

export const API_BASE_URL = defaultBaseUrl();

async function readEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = parsed?.error;
    throw new ApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      typeof error?.message === "string" ? error.message : response.statusText,
    );
  }
  return (parsed as ApiEnvelope<T>).data;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  return readEnvelope<T>(response);
}

export function verifyPlatformPin(pin: string) {
  return api<{ authenticated: boolean; expiresAt: string; idleExpiresAt: string }>(
    "/api/v1/auth/pin/verify",
    {
      method: "POST",
      body: JSON.stringify({ pin }),
    },
  );
}

export function verifyControlPin(pin: string) {
  return api<{ controlAuthorized: boolean; expiresAt: string }>("/api/v1/control-auth/verify", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function deleteSession() {
  return api<{ authenticated: boolean }>("/api/v1/auth/session", { method: "DELETE" });
}

export function getBootstrap() {
  return api<OfficeSnapshot>("/api/v1/bootstrap");
}

export function getActivity() {
  return api<{ items: ActivityItem[]; nextCursor: string | null }>("/api/v1/activity");
}

export function getAlerts() {
  return api<{ alerts: Alert[] }>("/api/v1/alerts");
}

export function updateAlert(alertId: string, action: "acknowledge" | "resolve" | "snooze" | "mute") {
  return api<Alert>(`/api/v1/alerts/${alertId}/${action}`, { method: "POST" });
}

export function commandDevice(deviceId: string, action: "on" | "off") {
  return api<{
    commandId: string;
    status: string;
    target: { type: "device"; id: string };
    action: "on" | "off";
    state: DeviceState;
  }>(`/api/v1/devices/${deviceId}/commands`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function shutdownRoom(roomId: RoomSlug) {
  return api(`/api/v1/rooms/${roomId}/commands/shutdown`, { method: "POST" });
}

export function shutdownOffice() {
  return api("/api/v1/office/commands/shutdown", { method: "POST" });
}

export function getOfficeClosingChecklist() {
  return api<{
    rooms: Array<{ roomId: RoomSlug; devicesOn: number; alerts: number; readyToClose: boolean }>;
    readyToClose: boolean;
  }>("/api/v1/office/closing-checklist");
}

export function emergencyShutdownOffice() {
  return api("/api/v1/office/commands/emergency-shutdown", { method: "POST" });
}

export function getDeviceUsage(deviceId: string) {
  return api<{
    deviceId: string;
    powerWatts: number;
    todayKwh: number;
    estimatedCostToday: number;
  }>(`/api/v1/devices/${deviceId}/usage`);
}

export function getEnergyHistory() {
  return api<{
    granularity: string;
    points: Array<{ recordedAt: string; powerWatts: number; estimatedKwh: number }>;
  }>("/api/v1/energy/history");
}

export function getEnergyRankings() {
  return api<{
    rooms: Array<{ roomId: RoomSlug; name: string; powerWatts: number }>;
    devices: Array<{ deviceId: string; label: string; roomId: RoomSlug; powerWatts: number }>;
  }>("/api/v1/energy/rankings");
}

export function getEnergySavings() {
  return api<{ estimatedKwhSaved: number; estimatedCostSaved: number; evidence: string }>("/api/v1/energy/savings");
}

export function getEnergyCarbon() {
  return api<{ energyKwh: number; kgCo2e: number; factor: number }>("/api/v1/energy/carbon");
}

export function getBillForecast() {
  return api<{ monthEndCost: number; currency: string; confidence: string }>("/api/v1/energy/forecast/bill");
}

export function getDeviceHistory(deviceId: string) {
  return api<{ items: ActivityItem[]; nextCursor: string | null }>(`/api/v1/devices/${deviceId}/history`);
}

export function getDeviceMaintenance(deviceId: string) {
  return api<{
    deviceId: string;
    status: string;
    runtimeHours: number;
    recommendations: string[];
  }>(`/api/v1/devices/${deviceId}/maintenance`);
}

export function getSystemComponents() {
  return api<{
    components: Array<{ id: string; status: string; lastSeenAt: string }>;
  }>("/api/v1/system/components");
}

export function createReport(format: "csv" | "pdf") {
  return api<ReportRequest>("/api/v1/reports", {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

export function getReports() {
  return api<{ reports: ReportRequest[] }>("/api/v1/reports");
}

export function reportDownloadUrl(format: "csv" | "pdf") {
  return `${API_BASE_URL}/api/v1/reports/downloads/${format}/latest`;
}

export async function downloadReport(format: "csv" | "pdf") {
  const response = await fetch(reportDownloadUrl(format), { credentials: "include" });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {
      if (text) message = text;
    }
    throw new ApiError(response.status, "REPORT_DOWNLOAD_FAILED", message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `officepulse-report.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getSettings() {
  return api<{
    timezone: string;
    officeOpenTime: string;
    officeCloseTime: string;
    tariffPerKwh: number;
    currency: string;
    carbonKgPerKwh: number;
  }>("/api/v1/settings");
}

export async function withControlRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "CONTROL_AUTH_REQUIRED") {
      throw error;
    }
    const pin = window.prompt("Re-enter the platform PIN to confirm this control action.");
    if (!pin) throw error;
    await verifyControlPin(pin);
    return operation();
  }
}

export function roomSlugFromName(name: string): RoomSlug {
  if (name.toLowerCase().includes("work room 1")) return "work1";
  if (name.toLowerCase().includes("work room 2")) return "work2";
  return "drawing";
}
