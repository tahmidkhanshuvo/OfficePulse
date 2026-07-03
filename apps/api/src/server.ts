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
import { buildOfficeSnapshot, InMemoryOfficeRepository } from "../../../packages/domain/src";
import { createLogger } from "../../../packages/logger/src";

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
    return json(context, {
      status: "ready",
      checks: {
        api: "ok",
        config: "ok",
        database: "not_configured_in_memory_mode",
        redis: "not_configured_in_memory_mode"
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
    return json(context, {
      components: [
        { id: "api", status: "healthy", lastSeenAt: new Date().toISOString() },
        { id: "database", status: "in_memory_mode", lastSeenAt: new Date().toISOString() },
        { id: "redis", status: "in_memory_mode", lastSeenAt: new Date().toISOString() }
      ]
    });
  }

  if (method === "GET" && path === "/api/v1/rooms") {
    return json(context, { rooms: snapshot(context).rooms });
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

  if (method === "GET" && path === "/api/v1/occupancy") {
    return json(context, { occupancy: snapshot(context).occupancy });
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

  if (method === "GET" && path === "/api/v1/alerts") {
    return json(context, { alerts: office.getAlerts() });
  }

  if (method === "GET" && path === "/api/v1/activity") {
    return json(context, {
      items: [
        {
          id: "activity_seed_boot",
          type: "system.started",
          message: "OfficePulse in-memory backend started.",
          occurredAt: new Date().toISOString()
        }
      ],
      nextCursor: null
    });
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
