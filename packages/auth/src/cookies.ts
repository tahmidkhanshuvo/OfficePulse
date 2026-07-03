export const PLATFORM_SESSION_COOKIE = "op_session";

export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

export function createSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${PLATFORM_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${PLATFORM_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
