export const authRoutes = [
  "POST /api/v1/auth/pin/verify",
  "GET /api/v1/auth/session",
  "POST /api/v1/auth/session/refresh",
  "DELETE /api/v1/auth/session",
  "POST /api/v1/control-auth/verify",
  "POST /api/v1/control-auth/refresh",
  "DELETE /api/v1/control-auth/session"
] as const;
