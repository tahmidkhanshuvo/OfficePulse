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
import { buildOfficeSnapshot, buildUsageRankings, InMemoryOfficeRepository } from "../../../packages/domain/src";
import { createLogger } from "../../../packages/logger/src";
import { checkRedisHealth } from "../../../packages/redis/src";

const config = loadConfig();
const logger = createLogger("api");
const office = new InMemoryOfficeRepository();
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

function snapshot(context: RequestContext) {
  return buildOfficeSnapshot(office, {
    currency: config.currency,
    tariffPerKwh: config.defaultTariffPerKwh,
    timezone: config.timezone,
    publicWsUrl: config.publicWsUrl,
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
    const todayKwh = Number(((device.state.powerWatts * 8) / 1000).toFixed(3));
    return json(context, {
      deviceId: device.id,
      powerWatts: device.state.powerWatts,
      todayKwh,
      estimatedCostToday: Number((todayKwh * config.defaultTariffPerKwh).toFixed(2))
    });
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
    return json(context, command, { status: 202 });
  }

  if (method === "POST" && path === "/api/v1/office/commands/shutdown") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    return json(context, office.shutdownOffice("Office shutdown requested", "dashboard"), { status: 202 });
  }

  if (method === "POST" && path === "/api/v1/office/commands/emergency-shutdown") {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    return json(context, office.shutdownOffice("Emergency shutdown requested", "dashboard"), { status: 202 });
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

  if (method === "GET" && path === "/api/v1/energy/rankings") {
    return json(context, buildUsageRankings(office));
  }

  if (method === "GET" && path === "/api/v1/energy/history") {
    const current = snapshot(context);
    return json(context, {
      granularity: "hour",
      points: [
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

  const alertActionMatch = path.match(/^\/api\/v1\/alerts\/([^/]+)\/(acknowledge|resolve|snooze|mute)$/);
  if (method === "POST" && alertActionMatch) {
    const controlError = requireControl(context);
    if (controlError) return controlError;
    const status = alertActionMatch[2] === "resolve" ? "resolved" : alertActionMatch[2] === "snooze" ? "snoozed" : "acknowledged";
    const alert = office.updateAlertStatus(alertActionMatch[1], status);
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
    const current = snapshot(context);
    if (reportDownloadMatch[1] === "csv") {
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
      return fileResponse(context, `${lines.join("\n")}\n`, "text/csv; charset=utf-8", "officepulse-report.csv");
    }

    const text = [
      "OfficePulse Report",
      `Generated At: ${current.generatedAt}`,
      `Total Power Watts: ${current.energy.totalPowerWatts}`,
      `Today kWh: ${current.energy.todayKwh}`,
      `Estimated Cost Today: ${current.energy.estimatedCostToday} ${current.energy.currency}`,
      `Active Alerts: ${current.alerts.length}`
    ].join("\n");
    return fileResponse(context, text, "application/pdf", "officepulse-report.pdf");
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
    const current = snapshot(context);
    const answer = `Current office load is ${current.energy.totalPowerWatts} W across ${current.devices.filter((device) => device.state.status === "on").length} active devices.`;
    return json(context, {
      conversationId: aiMessageMatch[1],
      answer,
      toolTrace: [{ tool: "get_office_snapshot", success: true }],
      message
    });
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
