export interface ControlAuthRecord {
  sessionId: string;
  expiresAt: number;
}

export class InMemoryControlAuthStore {
  private readonly grants = new Map<string, ControlAuthRecord>();

  constructor(private readonly ttlSeconds: number) {}

  grant(sessionId: string, now = Date.now()): ControlAuthRecord {
    const record = {
      sessionId,
      expiresAt: now + this.ttlSeconds * 1000
    };
    this.grants.set(sessionId, record);
    return { ...record };
  }

  get(sessionId: string | null, now = Date.now()): ControlAuthRecord | null {
    if (!sessionId) return null;
    const record = this.grants.get(sessionId);
    if (!record) return null;
    if (record.expiresAt <= now) {
      this.grants.delete(sessionId);
      return null;
    }
    return { ...record };
  }

  revoke(sessionId: string | null): void {
    if (sessionId) this.grants.delete(sessionId);
  }
}
