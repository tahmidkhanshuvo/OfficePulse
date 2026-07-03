export interface AppConfig {
  nodeEnv: string;
  appEnv: string;
  timezone: string;
  apiPort: number;
  publicApiUrl: string;
  publicWsUrl: string;
  corsOrigins: string[];
  platformPinHash: string;
  platformSessionTtlSeconds: number;
  platformIdleTimeoutSeconds: number;
  controlReauthTtlSeconds: number;
  sessionCookieSecret: string;
  defaultTariffPerKwh: number;
  currency: string;
  carbonKgPerKwh: number;
  officeOpenTime: string;
  officeCloseTime: string;
  pirRecentSeconds: number;
  pirVacantSeconds: number;
  telemetryStaleSeconds: number;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = Bun.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

function stringFromEnv(name: string, fallback = ""): string {
  return Bun.env[name] ?? fallback;
}

export function loadConfig(): AppConfig {
  const nodeEnv = stringFromEnv("NODE_ENV", "development");
  return {
    nodeEnv,
    appEnv: stringFromEnv("APP_ENV", "local"),
    timezone: stringFromEnv("APP_TIMEZONE", "Asia/Dhaka"),
    apiPort: numberFromEnv("API_PORT", 3000),
    publicApiUrl: stringFromEnv("PUBLIC_API_URL", "http://localhost:3000"),
    publicWsUrl: stringFromEnv("PUBLIC_WS_URL", "ws://localhost:3000/ws"),
    corsOrigins: stringFromEnv("CORS_ORIGINS", "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    platformPinHash: stringFromEnv("PLATFORM_PIN_HASH"),
    platformSessionTtlSeconds: numberFromEnv("PLATFORM_SESSION_TTL_SECONDS", 28800),
    platformIdleTimeoutSeconds: numberFromEnv("PLATFORM_IDLE_TIMEOUT_SECONDS", 1800),
    controlReauthTtlSeconds: numberFromEnv("CONTROL_REAUTH_TTL_SECONDS", 300),
    sessionCookieSecret: stringFromEnv("SESSION_COOKIE_SECRET", "local-dev-session-secret"),
    defaultTariffPerKwh: numberFromEnv("DEFAULT_TARIFF_PER_KWH", 12),
    currency: stringFromEnv("CURRENCY", "BDT"),
    carbonKgPerKwh: numberFromEnv("CARBON_KG_PER_KWH", 0.62),
    officeOpenTime: stringFromEnv("OFFICE_OPEN_TIME", "09:00"),
    officeCloseTime: stringFromEnv("OFFICE_CLOSE_TIME", "17:00"),
    pirRecentSeconds: numberFromEnv("PIR_RECENT_SECONDS", 120),
    pirVacantSeconds: numberFromEnv("PIR_VACANT_SECONDS", 900),
    telemetryStaleSeconds: numberFromEnv("TELEMETRY_STALE_SECONDS", 90)
  };
}
