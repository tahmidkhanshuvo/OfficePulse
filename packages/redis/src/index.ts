export const redisKeys = {
  officeSnapshot: "cache:office:snapshot",
  deviceState: (deviceId: string) => `state:device:${deviceId}`,
  occupancyState: (roomId: string) => `state:occupancy:${roomId}`,
  alertDedupe: (fingerprint: string) => `dedupe:alert:${fingerprint}`,
  automationLock: (scope: string) => `lock:automation:${scope}`,
  platformSession: (tokenHash: string) => `session:platform:${tokenHash}`,
  controlSession: (tokenHash: string) => `session:control:${tokenHash}`,
  componentHealth: (id: string) => `health:component:${id}`
};

export const redisStreams = {
  telemetry: "stream:telemetry",
  domainEvents: "stream:domain-events",
  automation: "stream:automation",
  reports: "stream:reports",
  realtime: "pubsub:realtime"
};

export interface RedisHealth {
  configured: boolean;
  status: "not_configured" | "ok" | "unavailable";
  error?: string;
}

export async function checkRedisHealth(redisUrl?: string): Promise<RedisHealth> {
  if (!redisUrl) return { configured: false, status: "not_configured" };
  try {
    const redis = new Bun.RedisClient(redisUrl);
    await redis.send("PING", []);
    redis.close();
    return { configured: true, status: "ok" };
  } catch (cause) {
    return {
      configured: true,
      status: "unavailable",
      error: cause instanceof Error ? cause.message : String(cause)
    };
  }
}
