import {
  InMemoryControlAuthStore,
  InMemorySessionStore,
  PLATFORM_SESSION_COOKIE,
  clearSessionCookie,
  createSessionCookie,
  parseCookies,
  verifyPlatformPin
} from "../../../packages/auth/src";
import { loadConfig } from "../../../packages/config/src";
import type { ApiEnvelope, ApiErrorEnvelope } from "../../../packages/contracts/src";
import { createPersistentOfficeRepository } from "../../../packages/db/src";
import { buildOfficeSnapshot, buildUsageRankings } from "../../../packages/domain/src";
import { createLogger } from "../../../packages/logger/src";
import { checkRedisHealth } from "../../../packages/redis/src";
import { DeviceTelemetryGenerator } from "./device-telemetry-generator";

const config = loadConfig();
const logger = createLogger("api");
const snapshotOptions = {
  currency: config.currency,
  tariffPerKwh: config.defaultTariffPerKwh,
  timezone: config.timezone,
  publicWsUrl: config.publicWsUrl,
  platformAuthenticated: false,
  controlAuthorized: false
};
const office = await createPersistentOfficeRepository({
  databaseUrl: config.databaseDirectUrl || config.databaseUrl,
  redisUrl: config.redisUrl,
  snapshotOptions,
  logger
});
const telemetryGenerator = new DeviceTelemetryGenerator(office);
telemetryGenerator.warmStartFromCurrentState();
const sessions = new InMemorySessionStore({
  ttlSeconds: config.platformSessionTtlSeconds,
  idleTimeoutSeconds: config.platformIdleTimeoutSeconds,
  secret: config.sessionCookieSecret
});
const controlAuth = new InMemoryControlAuthStore(config.controlReauthTtlSeconds);

interface RequestContext {
  request: Request;
  requestId: string;
  url: URL;
  sessionToken: string | null;
  session: ReturnType<InMemorySessionStore["get"]>;
  controlAuthorized: boolean;
}

function makeContext(request: Request): RequestContext {
  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionToken = cookies.get(PLATFORM_SESSION_COOKIE) ?? null;
  const session = sessions.get(sessionToken);
  const controlAuthorized = Boolean(controlAuth.get(session?.id ?? null));
  if (sessionToken && session) sessions.refresh(sessionToken);
  return { request, requestId, url, sessionToken, session, controlAuthorized };
}

function withCors(request: Request, headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  const origin = request.headers.get("origin");
  if (origin && config.corsOrigins.includes(origin)) {
    result.set("Access-Control-Allow-Origin", origin);
    result.set("Access-Control-Allow-Credentials", "true");
    result.set("Vary", "Origin");
  }
  result.set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Request-Id");
  result.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return result;
}

function json<T>(context: RequestContext, data: T, init: ResponseInit = {}): Response {
  const body: ApiEnvelope<T> = {
    data,
    meta: {
      requestId: context.requestId,
      generatedAt: new Date().toISOString(),
      stateVersion: office.getStateVersion()
    }
  };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: withCors(context.request, {
      "content-type": "application/json; charset=utf-8",
      ...init.headers
    })
  });
}

function error(
  context: RequestContext,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
  const body: ApiErrorEnvelope = {
    error: {
      code,
      message,
      details,
      requestId: context.requestId
    }
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors(context.request, {
      "content-type": "application/json; charset=utf-8"
    })
  });
}

function fileResponse(
  context: RequestContext,
  body: BodyInit,
  contentType: string,
  filename: string
): Response {
  return new Response(body, {
    headers: withCors(context.request, {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`
    })
  });
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdf(lines: string[]): ArrayBuffer {
  const content = [
    "BT",
    "/F1 14 Tf",
    "50 780 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -22 Td",
      `(${escapePdfText(line)}) Tj`
    ]).filter(Boolean),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const bytes = new TextEncoder().encode(pdf);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function reportFile(context: RequestContext, format: "csv" | "pdf", filename: string): Response {
  const current = snapshot(context);
  if (format === "csv") {
    const lines = [
      "room_id,room_name,power_watts,active_device_count,alert_count",
      ...current.rooms.map((room) =>
        [
          room.room.slug,
          room.room.name,
          room.powerWatts,
          room.activeDeviceCount,
          room.alerts.length
        ].join(",")
      )
    ];
    return fileResponse(context, `${lines.join("\n")}\n`, "text/csv; charset=utf-8", filename);
  }

  const text = [
    "OfficePulse Report",
    `Generated At: ${current.generatedAt}`,
    `Total Power Watts: ${current.energy.totalPowerWatts}`,
    `Today kWh: ${current.energy.todayKwh}`,
    `Estimated Cost Today: ${current.energy.estimatedCostToday} ${current.energy.currency}`,
    `Active Alerts: ${current.alerts.length}`,
    "",
    ...current.rooms.map((room) => `${room.room.name}: ${room.powerWatts}W, ${room.activeDeviceCount} active devices`)
  ];
  return fileResponse(context, createSimplePdf(text), "application/pdf", filename);
}

function snapshot(context: RequestContext) {
  return buildOfficeSnapshot(office, {
    ...snapshotOptions,
    platformAuthenticated: Boolean(context.session),
    controlAuthorized: context.controlAuthorized
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) return {};
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function roomFromText(text: string) {
  if (/(drawing|living)/.test(text)) return "drawing" as const;
  if (/(work\s*room\s*1|work1|room\s*1)/.test(text)) return "work1" as const;
  if (/(work\s*room\s*2|work2|room\s*2)/.test(text)) return "work2" as const;
  return null;
}

function deviceTypeFromText(text: string): "fan" | "light" | null {
  if (/\bfans?\b/.test(text)) return "fan";
  if (/\blights?\b|lighting/.test(text)) return "light";
  return null;
}

function deviceNumberFromText(text: string): number | null {
  const match = text.match(/\b(?:fan|light)\s*(\d+)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatRoomName(roomId: string) {
  if (roomId === "drawing") return "Drawing Room";
  if (roomId === "work1") return "Work Room 1";
  if (roomId === "work2") return "Work Room 2";
  return roomId;
}

async function getCurrentMonthBilling() {
  const persisted = await office.getCurrentMonthRoomEnergy(config.defaultTariffPerKwh);
  if (persisted.length > 0 && persisted.some((room) => room.energyKwh > 0)) {
    return persisted;
  }
  const current = buildOfficeSnapshot(office, snapshotOptions);
  const elapsedMonthHours = Math.max(
    1,
    (Date.now() - new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()) / 3_600_000
  );
  return current.rooms.map((room) => {
    const energyKwh = Number(((room.powerWatts / 1000) * elapsedMonthHours).toFixed(4));
    return {
      roomId: room.room.slug,
      roomName: room.room.name,
      energyKwh,
      cost: Number((energyKwh * config.defaultTariffPerKwh).toFixed(2)),
      currencyTariff: config.defaultTariffPerKwh
    };
  });
}

async function buildAgentReply(context: RequestContext, message: string) {
  const lower = message.toLowerCase();
  const current = snapshot(context);
  const roomId = roomFromText(lower);
  const deviceType = deviceTypeFromText(lower);
  const deviceNumber = deviceNumberFromText(lower);
  const wantsOff = /(turn|switch|power|shut)\s*(all\s*)?off|shutdown|shut down/.test(lower);
  const wantsOn = /(turn|switch|power)\s*(all\s*)?on/.test(lower);
  const toolTrace: Array<{ tool: string; success: boolean; details?: string }> = [];

  if (wantsOff || wantsOn) {
    const action = wantsOff ? "off" : "on";
    const controlError = requireControl(context);
    if (controlError) return controlError;

    if (wantsOff && /(office|everything|all rooms|all devices)/.test(lower)) {
      office.shutdownOffice("Pulse assistant requested office shutdown", "pulse");
      telemetryGenerator.syncOffice("off");
      toolTrace.push({ tool: "propose_office_shutdown", success: true });
      return json(context, {
        conversationId: context.url.pathname.split("/")[5] ?? "pulse",
        answer: "Done. I turned off all office devices.",
        toolTrace,
        message
      });
    }

    if (roomId && wantsOff && !deviceType) {
      office.shutdownRoom(roomId, "Pulse assistant requested room shutdown", "pulse");
      telemetryGenerator.syncRoom(roomId, "off");
      toolTrace.push({ tool: "propose_room_shutdown", success: true, details: roomId });
      return json(context, {
        conversationId: context.url.pathname.split("/")[5] ?? "pulse",
        answer: `Done. I turned off ${formatRoomName(roomId)}.`,
        toolTrace,
        message
      });
    }

    let targets = current.devices;
    if (roomId) targets = targets.filter((device) => device.roomId === roomId);
    if (deviceType) targets = targets.filter((device) => device.type === deviceType);
    if (deviceType && deviceNumber) targets = targets.filter((device) => device.label.toLowerCase() === `${deviceType} ${deviceNumber}`);
    if (targets.length === 0) {
      return json(context, {
        conversationId: context.url.pathname.split("/")[5] ?? "pulse",
        answer: "I could not find a matching device. Try saying the room and device, like 'turn off Work Room 1 fan 1'.",
        toolTrace: [{ tool: "propose_device_command", success: false, details: "no_target" }],
        message
      });
    }
    for (const device of targets) {
      office.updateDeviceState(device.id, action, "api");
      telemetryGenerator.syncDevice(device.id, action);
    }
    toolTrace.push({ tool: "propose_device_command", success: true, details: `${targets.length} devices ${action}` });
    const scope = roomId ? ` in ${formatRoomName(roomId)}` : "";
    const label = deviceType ? `${deviceType}${targets.length > 1 ? "s" : ""}` : `${targets.length} device${targets.length === 1 ? "" : "s"}`;
    return json(context, {
      conversationId: context.url.pathname.split("/")[5] ?? "pulse",
      answer: `Done. I turned ${action} ${label}${scope}.`,
      toolTrace,
      message
    });
  }

  if (/alert|issue|warning/.test(lower)) {
    const active = current.alerts.filter((alert) => alert.status === "active");
    toolTrace.push({ tool: "list_active_alerts", success: true });
    return json(context, {
      conversationId: context.url.pathname.split("/")[5] ?? "pulse",
      answer: active.length === 0
        ? "There are no active alerts right now."
        : `Active alerts: ${active.map((alert) => `${alert.title} (${alert.severity})`).join("; ")}.`,
      toolTrace,
      message
    });
  }

  if (/bill|monthly|cost|forecast/.test(lower)) {
    const billing = await getCurrentMonthBilling();
    const lines = billing.map((room) => `${room.roomName}: ${room.energyKwh.toFixed(2)} kWh, ${room.cost.toFixed(2)} ${config.currency}`);
    toolTrace.push({ tool: "get_usage_summary", success: true });
    return json(context, {
      conversationId: context.url.pathname.split("/")[5] ?? "pulse",
      answer: `Current month bill so far: ${lines.join("; ")}.`,
      toolTrace,
      message
    });
  }

  if (/advice|recommend|optimi[sz]e|save|waste/.test(lower)) {
    const activeRooms = current.rooms.filter((room) => room.activeDeviceCount > 0);
    const vacantWaste = activeRooms.filter((room) => room.occupancy.state === "vacant");
    const highest = [...current.rooms].sort((a, b) => b.powerWatts - a.powerWatts)[0];
    const advice = vacantWaste.length > 0
      ? `Start with ${vacantWaste.map((room) => room.room.name).join(", ")} because it is vacant with devices still on.`
      : highest
        ? `${highest.room.name} is drawing the most power at ${highest.powerWatts.toFixed(2)}W. Check whether its fans or lights are still needed.`
        : "Everything looks quiet right now.";
    toolTrace.push({ tool: "get_office_snapshot", success: true });
    return json(context, {
      conversationId: context.url.pathname.split("/")[5] ?? "pulse",
      answer: advice,
      toolTrace,
      message
    });
  }

  if (/health|system|redis|database|api/.test(lower)) {
    const redis = await checkRedisHealth(config.redisUrl);
    toolTrace.push({ tool: "get_system_health", success: true });
    return json(context, {
      conversationId: context.url.pathname.split("/")[5] ?? "pulse",
      answer: `System health: API healthy, database ${config.databaseUrl ? "configured" : "not configured"}, Redis ${redis.status}.`,
      toolTrace,
      message
    });
  }

  const roomLines = current.rooms.map((room) => {
    const fans = room.devices.filter((device) => device.type === "fan" && device.state.status === "on").length;
    const lights = room.devices.filter((device) => device.type === "light" && device.state.status === "on").length;
    return `${room.room.name}: ${room.powerWatts.toFixed(2)}W, ${fans} fans on, ${lights} lights on, occupancy ${room.occupancy.state.replace("_", " ")}`;
  });
  toolTrace.push({ tool: "get_office_snapshot", success: true });
  return json(context, {
    conversationId: context.url.pathname.split("/")[5] ?? "pulse",
    answer: `Current office load is ${current.energy.totalPowerWatts.toFixed(2)}W. ${roomLines.join("; ")}.`,
    toolTrace,
    message
  });
}

function requirePlatform(context: RequestContext): Response | null {
  if (context.session) return null;
  return error(context, 401, "PLATFORM_AUTH_REQUIRED", "A valid platform PIN session is required.");
}

function requireControl(context: RequestContext): Response | null {
  const platformError = requirePlatform(context);
  if (platformError) return platformError;
  if (context.controlAuthorized) return null;
  return error(context, 401, "CONTROL_AUTH_REQUIRED", "Recent PIN re-verification is required for this action.");
}

async function route(context: RequestContext): Promise<Response> {
  const { request, url } = context;
  const method = request.method;
  const path = url.pathname;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withCors(request) });
  }

  if (method === "GET" && path === "/health") {
    return json(context, { status: "ok", component: "api" });
  }

  if (method === "GET" && path === "/ready") {
    const redis = await checkRedisHealth(config.redisUrl);
    return json(context, {
      status: "ready",
      checks: {
        api: "ok",
        config: "ok",
        database: config.databaseUrl ? "configured" : "not_configured_in_memory_mode",
        redis: redis.status
      }
    });
  }

  if (method === "POST" && path === "/api/v1/auth/pin/verify") {
    const body = await readJson(request);
    const pin = typeof body.pin === "string" ? body.pin : "";
    const valid = await verifyPlatformPin(pin, {
      pinHash: config.platformPinHash,
      nodeEnv: config.nodeEnv,
      devPin: Bun.env.PLATFORM_DEV_PIN
    });
    if (!valid) {
      return error(context, 401, "INVALID_PLATFORM_PIN", "The supplied platform PIN is invalid.");
    }
    const created = sessions.create();
    return json(
      context,
      {
        authenticated: true,
        expiresAt: new Date(created.record.expiresAt).toISOString(),
        idleExpiresAt: new Date(created.record.idleExpiresAt).toISOString()
      },
      {
        headers: {
          "Set-Cookie": createSessionCookie(created.token, config.platformSessionTtlSeconds)
        }
      }
    );
  }

  if (method === "GET" && path === "/api/v1/auth/session") {
    return json(context, {
      authenticated: Boolean(context.session),
      expiresAt: context.session ? new Date(context.session.expiresAt).toISOString() : null,
      idleExpiresAt: context.session ? new Date(context.session.idleExpiresAt).toISOString() : null,
      controlAuthorized: context.controlAuthorized
    });
  }

  if (method === "POST" && path === "/api/v1/auth/session/refresh") {
    const platformError = requirePlatform(context);
    if (platformError) return platformError;
    const refreshed = sessions.refresh(context.sessionToken ?? "");
    return json(context, {
      authenticated: Boolean(refreshed),
      expiresAt: refreshed ? new Date(refreshed.expiresAt).toISOString() : null,
      idleExpiresAt: refreshed ? new Date(refreshed.idleExpiresAt).toISOString() : null
    });
  }

  if (method === "DELETE" && path === "/api/v1/auth/session") {
    sessions.revoke(context.sessionToken);
    controlAuth.revoke(context.session?.id ?? null);
    return json(
      context,
      { authenticated: false },
      {
        headers: {
          "Set-Cookie": clearSessionCookie()
        }
      }
    );
  }

  if (method === "POST" && path === "/api/v1/control-auth/verify") {
    const platformError = requirePlatform(context);
    if (platformError) return platformError;
    const body = await readJson(request);
    const pin = typeof body.pin === "string" ? body.pin : "";
    const valid = await verifyPlatformPin(pin, {
      pinHash: config.platformPinHash,
      nodeEnv: config.nodeEnv,
      devPin: Bun.env.PLATFORM_DEV_PIN
    });
    if (!valid || !context.session) {
      return error(context, 401, "INVALID_CONTROL_PIN", "Recent control PIN re-verification failed.");
    }
    const grant = controlAuth.grant(context.session.id);
    return json(context, {
      controlAuthorized: true,
      expiresAt: new Date(grant.expiresAt).toISOString()
    });
  }

  if (method === "POST" && path === "/api/v1/control-auth/refresh") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const grant = controlAuth.grant(context.session?.id ?? "");
    return json(context, {
      controlAuthorized: true,
      expiresAt: new Date(grant.expiresAt).toISOString()
    });
  }

  if (method === "DELETE" && path === "/api/v1/control-auth/session") {
    const platformError = requirePlatform(context);
    if (platformError) return platformError;
    controlAuth.revoke(context.session?.id ?? null);
    return json(context, { controlAuthorized: false });
  }

  if (path.startsWith("/api/v1/")) {
    const platformError = requirePlatform(context);
    if (platformError) return platformError;
  }

  if (method === "GET" && path === "/api/v1/bootstrap") {
    return json(context, snapshot(context));
  }

  if (method === "GET" && path === "/api/v1/config/public") {
    return json(context, {
      timezone: config.timezone,
      currency: config.currency,
      featureFlags: {
        aiChat: Bun.env.FEATURE_AI_CHAT === "true",
        autoShutdown: Bun.env.FEATURE_AUTO_SHUTDOWN === "true",
        publicDisplay: Bun.env.FEATURE_PUBLIC_DISPLAY === "true",
        reports: Bun.env.FEATURE_REPORTS === "true"
      }
    });
  }

  if (method === "GET" && path === "/api/v1/system/components") {
    const redis = await checkRedisHealth(config.redisUrl);
    return json(context, {
      components: [
        { id: "api", status: "healthy", lastSeenAt: new Date().toISOString() },
        { id: "database", status: config.databaseUrl ? "configured" : "in_memory_mode", lastSeenAt: new Date().toISOString() },
        { id: "redis", status: redis.status, lastSeenAt: new Date().toISOString() }
      ]
    });
  }

  if (method === "GET" && path === "/api/v1/rooms") {
    return json(context, { rooms: snapshot(context).rooms });
  }

  const roomSnapshotMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/snapshot$/);
  if (method === "GET" && roomSnapshotMatch) {
    const room = snapshot(context).rooms.find((candidate) => candidate.room.slug === roomSnapshotMatch[1]);
    if (!room) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomSnapshotMatch[1] });
    return json(context, {
      roomId: room.room.slug,
      powerWatts: room.powerWatts,
      activeDeviceCount: room.activeDeviceCount,
      occupancy: room.occupancy,
      alerts: room.alerts
    });
  }

  const roomDevicesMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/devices$/);
  if (method === "GET" && roomDevicesMatch) {
    const room = snapshot(context).rooms.find((candidate) => candidate.room.slug === roomDevicesMatch[1]);
    if (!room) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomDevicesMatch[1] });
    return json(context, { devices: room.devices });
  }

  const roomActivityMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/activity$/);
  if (method === "GET" && roomActivityMatch) {
    return json(context, {
      items: office.getActivity().filter((item) => item.roomId === roomActivityMatch[1]),
      nextCursor: null
    });
  }

  const roomEfficiencyMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/efficiency$/);
  if (method === "GET" && roomEfficiencyMatch) {
    const room = snapshot(context).rooms.find((candidate) => candidate.room.slug === roomEfficiencyMatch[1]);
    if (!room) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomEfficiencyMatch[1] });
    const wastePenalty = room.alerts.length * 10;
    return json(context, {
      roomId: room.room.slug,
      score: Math.max(0, 100 - wastePenalty - room.powerWatts / 10),
      factors: {
        activeAlerts: room.alerts.length,
        currentPowerWatts: room.powerWatts,
        occupancyState: room.occupancy.state
      }
    });
  }

  const roomChecklistMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/closing-checklist$/);
  if (method === "GET" && roomChecklistMatch) {
    const room = snapshot(context).rooms.find((candidate) => candidate.room.slug === roomChecklistMatch[1]);
    if (!room) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomChecklistMatch[1] });
    return json(context, {
      roomId: room.room.slug,
      devicesOn: room.devices.filter((device) => device.state.status === "on"),
      alerts: room.alerts,
      readyToClose: room.activeDeviceCount === 0 && room.alerts.length === 0
    });
  }

  if (method === "GET" && path === "/api/v1/office/closing-checklist") {
    const current = snapshot(context);
    return json(context, {
      rooms: current.rooms.map((room) => ({
        roomId: room.room.slug,
        devicesOn: room.devices.filter((device) => device.state.status === "on").length,
        alerts: room.alerts.length,
        readyToClose: room.activeDeviceCount === 0 && room.alerts.length === 0
      })),
      readyToClose: current.devices.every((device) => device.state.status !== "on") && current.alerts.length === 0
    });
  }

  const roomMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)$/);
  if (method === "GET" && roomMatch) {
    const room = snapshot(context).rooms.find((candidate) => candidate.room.slug === roomMatch[1]);
    if (!room) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomMatch[1] });
    return json(context, room);
  }

  if (method === "GET" && path === "/api/v1/devices") {
    return json(context, { devices: snapshot(context).devices });
  }

  const deviceMatch = path.match(/^\/api\/v1\/devices\/([^/]+)$/);
  if (method === "GET" && deviceMatch) {
    const device = snapshot(context).devices.find((candidate) => candidate.id === deviceMatch[1]);
    if (!device) return error(context, 404, "DEVICE_NOT_FOUND", "Device not found.", { deviceId: deviceMatch[1] });
    return json(context, device);
  }

  const deviceUsageMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/usage$/);
  if (method === "GET" && deviceUsageMatch) {
    const device = snapshot(context).devices.find((candidate) => candidate.id === deviceUsageMatch[1]);
    if (!device) return error(context, 404, "DEVICE_NOT_FOUND", "Device not found.", { deviceId: deviceUsageMatch[1] });
    const persistedUsage = await office.getDeviceUsageToday(device.id);
    const todayKwh = persistedUsage?.todayKwh ?? Number(((device.state.powerWatts * 8) / 1000).toFixed(3));
    return json(context, {
      deviceId: device.id,
      powerWatts: device.state.powerWatts,
      todayKwh,
      estimatedCostToday: Number((todayKwh * config.defaultTariffPerKwh).toFixed(2)),
      runtimeHours: persistedUsage?.runtimeHours ?? (device.state.status === "on" ? 8 : 0),
      averagePowerWatts: persistedUsage?.averagePowerWatts ?? device.state.powerWatts,
      sampleCount: persistedUsage?.sampleCount ?? 0
    });
  }

  const deviceTelemetryMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/telemetry$/);
  if (method === "GET" && deviceTelemetryMatch) {
    const device = snapshot(context).devices.find((candidate) => candidate.id === deviceTelemetryMatch[1]);
    if (!device) return error(context, 404, "DEVICE_NOT_FOUND", "Device not found.", { deviceId: deviceTelemetryMatch[1] });
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 48), 1), 200);
    const points = await office.getDeviceTelemetry(device.id, limit);
    return json(context, { deviceId: device.id, points });
  }

  const deviceHistoryMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/history$/);
  if (method === "GET" && deviceHistoryMatch) {
    return json(context, {
      items: office.getActivity().filter((item) => item.deviceId === deviceHistoryMatch[1]),
      nextCursor: null
    });
  }

  const deviceMaintenanceMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/maintenance$/);
  if (method === "GET" && deviceMaintenanceMatch) {
    const device = snapshot(context).devices.find((candidate) => candidate.id === deviceMaintenanceMatch[1]);
    if (!device) return error(context, 404, "DEVICE_NOT_FOUND", "Device not found.", { deviceId: deviceMaintenanceMatch[1] });
    return json(context, {
      deviceId: device.id,
      status: "ok",
      runtimeHours: device.state.status === "on" ? 8 : 0,
      recommendations: device.state.powerWatts > device.ratedWatts * 1.25 ? ["Inspect abnormal wattage."] : []
    });
  }

  const commandMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/commands$/);
  if (method === "POST" && commandMatch) {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const body = await readJson(request);
    const action = body.action;
    if (action !== "on" && action !== "off") {
      return error(context, 400, "INVALID_COMMAND_ACTION", "Device command action must be on or off.");
    }
    const state = office.updateDeviceState(commandMatch[1], action, "api");
    if (!state) return error(context, 404, "DEVICE_NOT_FOUND", "Device not found.", { deviceId: commandMatch[1] });
    telemetryGenerator.syncDevice(commandMatch[1], action);
    return json(
      context,
      {
        commandId: `cmd_${crypto.randomUUID()}`,
        status: "succeeded",
        target: { type: "device", id: commandMatch[1] },
        action,
        state
      },
      { status: 202 }
    );
  }

  const roomShutdownMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/commands\/shutdown$/);
  if (method === "POST" && roomShutdownMatch) {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const command = office.shutdownRoom(roomShutdownMatch[1] as never, "Room shutdown requested", "dashboard");
    if (!command) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomShutdownMatch[1] });
    telemetryGenerator.syncRoom(roomShutdownMatch[1], "off");
    return json(context, command, { status: 202 });
  }

  if (method === "POST" && path === "/api/v1/office/commands/shutdown") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const command = office.shutdownOffice("Office shutdown requested", "dashboard");
    telemetryGenerator.syncOffice("off");
    return json(context, command, { status: 202 });
  }

  if (method === "POST" && path === "/api/v1/office/commands/emergency-shutdown") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const command = office.shutdownOffice("Emergency shutdown requested", "dashboard");
    telemetryGenerator.syncOffice("off");
    return json(context, command, { status: 202 });
  }

  if (method === "GET" && path === "/api/v1/occupancy") {
    return json(context, { occupancy: snapshot(context).occupancy });
  }

  const roomOccupancyMatch = path.match(/^\/api\/v1\/rooms\/([^/]+)\/occupancy$/);
  if (method === "GET" && roomOccupancyMatch) {
    const occupancy = snapshot(context).occupancy.find((item) => item.roomId === roomOccupancyMatch[1]);
    if (!occupancy) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: roomOccupancyMatch[1] });
    return json(context, occupancy);
  }

  if (method === "GET" && path === "/api/v1/energy/live") {
    const current = snapshot(context);
    return json(context, {
      totalPowerWatts: current.energy.totalPowerWatts,
      rooms: current.rooms.map((room) => ({
        roomId: room.room.slug,
        powerWatts: room.powerWatts,
        activeDeviceCount: room.activeDeviceCount
      }))
    });
  }

  if (method === "GET" && path === "/api/v1/energy/today") {
    return json(context, snapshot(context).energy);
  }

  if (method === "GET" && path === "/api/v1/energy/month-to-date") {
    const rooms = await getCurrentMonthBilling();
    return json(context, {
      currency: config.currency,
      tariffPerKwh: config.defaultTariffPerKwh,
      month: new Date().toISOString().slice(0, 7),
      rooms,
      totalKwh: Number(rooms.reduce((total, room) => total + room.energyKwh, 0).toFixed(4)),
      totalCost: Number(rooms.reduce((total, room) => total + room.cost, 0).toFixed(2))
    });
  }

  if (method === "GET" && path === "/api/v1/energy/rankings") {
    return json(context, buildUsageRankings(office));
  }

  if (method === "GET" && path === "/api/v1/energy/history") {
    const current = snapshot(context);
    const persistedPoints = await office.getEnergyHistoryPoints(48);
    return json(context, {
      granularity: "hour",
      points: persistedPoints.length > 0 ? persistedPoints : [
        {
          recordedAt: current.generatedAt,
          powerWatts: current.energy.totalPowerWatts,
          estimatedKwh: current.energy.todayKwh
        }
      ]
    });
  }

  if (method === "GET" && path === "/api/v1/energy/savings") {
    return json(context, { estimatedKwhSaved: 0, estimatedCostSaved: 0, evidence: "No completed automation savings yet." });
  }

  if (method === "GET" && path === "/api/v1/energy/carbon") {
    const energy = snapshot(context).energy;
    return json(context, {
      energyKwh: energy.todayKwh,
      kgCo2e: Number((energy.todayKwh * config.carbonKgPerKwh).toFixed(3)),
      factor: config.carbonKgPerKwh
    });
  }

  if (method === "GET" && path === "/api/v1/energy/forecast/bill") {
    const energy = snapshot(context).energy;
    return json(context, {
      monthEndCost: Number((energy.estimatedCostToday * 30).toFixed(2)),
      currency: config.currency,
      confidence: "demo-estimate"
    });
  }

  if (method === "GET" && path === "/api/v1/alerts") {
    return json(context, { alerts: office.getAlerts() });
  }

  if (method === "GET" && path === "/api/v1/alerts/summary") {
    const alerts = office.getAlerts();
    return json(context, {
      active: alerts.filter((alert) => alert.status === "active").length,
      warning: alerts.filter((alert) => alert.severity === "warning").length,
      critical: alerts.filter((alert) => alert.severity === "critical").length
    });
  }

  const alertActionMatch = path.match(/^\/api\/v1\/alerts\/([^/]+)\/(resolve|snooze|forget)$/);
  if (method === "POST" && alertActionMatch) {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const alertId = alertActionMatch[1];
    const action = alertActionMatch[2];
    const currentAlert = office.getAlerts().find((alert) => alert.id === alertId);
    if (!currentAlert) return error(context, 404, "ALERT_NOT_FOUND", "Alert not found.", { alertId });

    if (action === "resolve") {
      if (currentAlert.roomId) {
        office.shutdownRoom(currentAlert.roomId, "Alert resolved from dashboard", "dashboard");
        telemetryGenerator.syncRoom(currentAlert.roomId, "off");
      } else if (currentAlert.deviceId) {
        office.updateDeviceState(currentAlert.deviceId, "off", "api");
        telemetryGenerator.syncDevice(currentAlert.deviceId, "off");
      }
      const alert = office.updateAlertStatus(alertId, "resolved") ?? {
        ...currentAlert,
        status: "resolved" as const,
        updatedAt: new Date().toISOString()
      };
      return json(context, alert);
    }

    const delayMs = action === "forget" ? 60 * 60 * 1000 : 2 * 60 * 1000;
    const suppressedUntil = new Date(Date.now() + delayMs).toISOString();
    const alert = office.updateAlertStatus(alertId, "snoozed", { suppressedUntil });
    if (!alert) return error(context, 404, "ALERT_NOT_FOUND", "Alert not found.", { alertId: alertActionMatch[1] });
    return json(context, alert);
  }

  if (method === "GET" && path === "/api/v1/alert-rules") {
    return json(context, {
      rules: [
        { id: "after_hours_device_on", enabled: true, severity: "warning" },
        { id: "all_room_devices_on_long", enabled: true, severity: "warning" },
        { id: "vacant_room_devices_on", enabled: true, severity: "warning" }
      ]
    });
  }

  if (method === "GET" && path === "/api/v1/activity") {
    return json(context, {
      items: office.getActivity(),
      nextCursor: null
    });
  }

  if (method === "POST" && path === "/api/v1/reports") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const body = await readJson(request);
    const format = body.format === "pdf" ? "pdf" : "csv";
    return json(context, office.createReport(format), { status: 202 });
  }

  if (method === "GET" && path === "/api/v1/reports") {
    return json(context, { reports: office.getReports() });
  }

  const reportDownloadMatch = path.match(/^\/api\/v1\/reports\/downloads\/(csv|pdf)\/latest$/);
  if (method === "GET" && reportDownloadMatch) {
    const format = reportDownloadMatch[1] as "csv" | "pdf";
    return reportFile(context, format, `officepulse-report.${format}`);
  }

  const reportFileMatch = path.match(/^\/api\/v1\/reports\/([^/]+)\/download$/);
  if (method === "GET" && reportFileMatch) {
    const report = office.getReports().find((item) => item.id === reportFileMatch[1]);
    if (!report) return error(context, 404, "REPORT_NOT_FOUND", "Report not found.", { reportId: reportFileMatch[1] });
    return reportFile(context, report.format, `${report.id}.${report.format}`);
  }

  const reportMatch = path.match(/^\/api\/v1\/reports\/([^/]+)$/);
  if (method === "GET" && reportMatch) {
    const report = office.getReports().find((item) => item.id === reportMatch[1]);
    if (!report) return error(context, 404, "REPORT_NOT_FOUND", "Report not found.", { reportId: reportMatch[1] });
    return json(context, report);
  }

  if (method === "POST" && path === "/api/v1/ai/conversations") {
    return json(context, {
      conversationId: `conv_${crypto.randomUUID()}`,
      title: "OfficePulse conversation",
      createdAt: new Date().toISOString()
    });
  }

  const aiMessageMatch = path.match(/^\/api\/v1\/ai\/conversations\/([^/]+)\/messages$/);
  if (method === "POST" && aiMessageMatch) {
    const body = await readJson(request);
    const message = typeof body.message === "string" ? body.message : "";
    return buildAgentReply(context, message);
  }

  const aiActionMatch = path.match(/^\/api\/v1\/ai\/actions\/([^/]+)\/(confirm|cancel)$/);
  if (method === "POST" && aiActionMatch) {
    const status = aiActionMatch[2] === "confirm" ? "confirmed" : "cancelled";
    if (status === "confirmed") {
      const controlError = requireControl(context);
      if (controlError) return controlError;
    }
    const action = office.updateAiAction(aiActionMatch[1], status);
    if (!action) return error(context, 404, "AI_ACTION_NOT_FOUND", "AI action not found.", { actionId: aiActionMatch[1] });
    return json(context, action);
  }

  if (method === "GET" && path === "/api/v1/integrations/discord") {
    const allowedControlUsers = Bun.env.DISCORD_ALLOWED_CONTROL_USER_IDS ?? "";
    return json(context, {
      configured: Boolean(Bun.env.DISCORD_APPLICATION_ID && Bun.env.DISCORD_BOT_TOKEN),
      guildId: Bun.env.DISCORD_GUILD_ID ?? null,
      alertChannelId: Bun.env.DISCORD_ALERT_CHANNEL_ID ?? null,
      commandChannelId: Bun.env.DISCORD_COMMAND_CHANNEL_ID || null,
      commandScope: Bun.env.DISCORD_COMMAND_CHANNEL_ID ? "single_channel" : "all_channels",
      controlAccess: allowedControlUsers === "*" ? "all_users" : "allowlist"
    });
  }

  if (method === "GET" && path === "/api/v1/simulator/status") {
    return json(context, { activeScenario: null, timeScale: Number(Bun.env.SIMULATOR_TIME_SCALE ?? 1), clock: new Date().toISOString() });
  }

  if (method === "GET" && path === "/api/v1/simulator/scenarios") {
    return json(context, {
      scenarios: [
        "normal-day",
        "lunch-break",
        "after-hours-waste",
        "all-on-two-hours",
        "peak-load",
        "abnormal-fan",
        "rapid-switching",
        "pir-silent",
        "gateway-offline",
        "closing-demo",
        "energy-saving",
        "all-off"
      ]
    });
  }

  if (method === "POST" && path === "/internal/v1/telemetry/devices") {
    const body = await readJson(request);
    const events = Array.isArray(body.events) ? body.events : [];
    const updated = office.ingestDeviceTelemetry(
      events
        .filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === "object")
        .map((event) => ({
          deviceId: String(event.deviceId ?? ""),
          status: event.status === "off" ? "off" : event.status === "unknown" ? "unknown" : "on",
          powerWatts: typeof event.powerWatts === "number" ? event.powerWatts : undefined,
          observedAt: typeof event.observedAt === "string" ? event.observedAt : undefined,
          source: "simulator"
        }))
    );
    return json(context, { updated });
  }

  if (method === "POST" && path === "/internal/v1/telemetry/occupancy") {
    const body = await readJson(request);
    const occupancy = office.ingestOccupancyTelemetry({
      roomId: String(body.roomId ?? "drawing") as never,
      motionDetected: body.motionDetected === true,
      observedAt: typeof body.observedAt === "string" ? body.observedAt : undefined,
      source: "simulator"
    });
    if (!occupancy) return error(context, 404, "ROOM_NOT_FOUND", "Room not found.", { roomId: body.roomId });
    return json(context, occupancy);
  }

  if (method === "GET" && path === "/api/v1/settings") {
    return json(context, {
      timezone: config.timezone,
      officeOpenTime: config.officeOpenTime,
      officeCloseTime: config.officeCloseTime,
      tariffPerKwh: config.defaultTariffPerKwh,
      currency: config.currency,
      carbonKgPerKwh: config.carbonKgPerKwh
    });
  }

  return error(context, 404, "NOT_FOUND", "Route not found.", { path });
}

const server = Bun.serve<{ sessionId: string }>({
  port: config.apiPort,
  hostname: "0.0.0.0",
  async fetch(request, server) {
    const context = makeContext(request);

    if (context.url.pathname === "/ws") {
      if (!context.session) {
        return error(context, 401, "PLATFORM_AUTH_REQUIRED", "WebSocket access requires a platform session.");
      }
      const upgraded = server.upgrade(request, {
        data: { sessionId: context.session.id }
      });
      if (upgraded) return undefined;
      return error(context, 400, "WEBSOCKET_UPGRADE_FAILED", "Unable to upgrade WebSocket connection.");
    }

    try {
      return await route(context);
    } catch (cause) {
      logger.error("Unhandled request error", {
        requestId: context.requestId,
        path: context.url.pathname,
        cause: cause instanceof Error ? cause.message : String(cause)
      });
      return error(context, 500, "INTERNAL_SERVER_ERROR", "Unexpected server error.");
    }
  },
  websocket: {
    open(ws) {
      ws.send(
        JSON.stringify({
          type: "subscribed",
          connectionId: `ws_${crypto.randomUUID()}`,
          stateVersion: office.getStateVersion(),
          heartbeatSeconds: 25
        })
      );
    },
    message(ws, rawMessage) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(rawMessage));
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "INVALID_JSON" }));
        return;
      }
      if (typeof parsed === "object" && parsed && "type" in parsed && parsed.type === "subscribe") {
        ws.send(
          JSON.stringify({
            type: "office.snapshot.updated",
            occurredAt: new Date().toISOString(),
            stateVersion: office.getStateVersion(),
            payload: buildOfficeSnapshot(office, {
              currency: config.currency,
              tariffPerKwh: config.defaultTariffPerKwh,
              timezone: config.timezone,
              publicWsUrl: config.publicWsUrl,
              platformAuthenticated: true,
              controlAuthorized: Boolean(controlAuth.get(ws.data.sessionId))
            })
          })
        );
        return;
      }
      ws.send(JSON.stringify({ type: "error", code: "UNSUPPORTED_MESSAGE" }));
    }
  }
});

logger.info("OfficePulse API listening", { port: server.port });
