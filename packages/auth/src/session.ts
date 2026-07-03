import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface SessionRecord {
  id: string;
  createdAt: number;
  expiresAt: number;
  idleExpiresAt: number;
  lastSeenAt: number;
}

export interface SessionStoreOptions {
  ttlSeconds: number;
  idleTimeoutSeconds: number;
  secret: string;
}

export class InMemorySessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly options: SessionStoreOptions) {}

  create(now = Date.now()): { token: string; record: SessionRecord } {
    const id = randomBytes(32).toString("base64url");
    const record: SessionRecord = {
      id,
      createdAt: now,
      expiresAt: now + this.options.ttlSeconds * 1000,
      idleExpiresAt: now + this.options.idleTimeoutSeconds * 1000,
      lastSeenAt: now
    };
    this.sessions.set(id, record);
    return { token: this.sign(id), record: { ...record } };
  }

  get(signedToken: string | null, now = Date.now()): SessionRecord | null {
    const id = signedToken ? this.verify(signedToken) : null;
    if (!id) return null;
    const record = this.sessions.get(id);
    if (!record) return null;
    if (record.expiresAt <= now || record.idleExpiresAt <= now) {
      this.sessions.delete(id);
      return null;
    }
    return { ...record };
  }

  refresh(signedToken: string, now = Date.now()): SessionRecord | null {
    const id = this.verify(signedToken);
    if (!id) return null;
    const record = this.sessions.get(id);
    if (!record || record.expiresAt <= now || record.idleExpiresAt <= now) {
      if (id) this.sessions.delete(id);
      return null;
    }
    record.lastSeenAt = now;
    record.idleExpiresAt = Math.min(record.expiresAt, now + this.options.idleTimeoutSeconds * 1000);
    return { ...record };
  }

  revoke(signedToken: string | null): void {
    const id = signedToken ? this.verify(signedToken) : null;
    if (id) this.sessions.delete(id);
  }

  private sign(id: string): string {
    const signature = createHmac("sha256", this.options.secret).update(id).digest("base64url");
    return `${id}.${signature}`;
  }

  private verify(signedToken: string): string | null {
    const [id, signature] = signedToken.split(".");
    if (!id || !signature) return null;
    const expected = createHmac("sha256", this.options.secret).update(id).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length) return null;
    return timingSafeEqual(actualBuffer, expectedBuffer) ? id : null;
  }
}
