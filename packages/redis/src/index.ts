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

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      }
    );
  });
}

export async function checkRedisHealth(redisUrl?: string, timeoutMs = 1500): Promise<RedisHealth> {
  if (!redisUrl) return { configured: false, status: "not_configured" };
  const redis = new Bun.RedisClient(redisUrl);
  try {
    await withTimeout(redis.send("PING", []), timeoutMs);
    return { configured: true, status: "ok" };
  } catch (cause) {
    return {
      configured: true,
      status: "unavailable",
      error: cause instanceof Error ? cause.message : String(cause)
    };
  } finally {
    redis.close();
  }
}
