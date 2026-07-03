import { describe, expect, test } from "bun:test";
import { InMemoryControlAuthStore, InMemorySessionStore, verifyPlatformPin } from "../../packages/auth/src";

describe("platform PIN verification", () => {
  test("allows the development fallback PIN outside production", async () => {
    await expect(verifyPlatformPin("123456", { pinHash: "", nodeEnv: "development" })).resolves.toBe(true);
    await expect(verifyPlatformPin("000000", { pinHash: "", nodeEnv: "development" })).resolves.toBe(false);
  });

  test("rejects malformed PIN values", async () => {
    await expect(verifyPlatformPin("12345", { pinHash: "", nodeEnv: "development" })).resolves.toBe(false);
    await expect(verifyPlatformPin("abcdef", { pinHash: "", nodeEnv: "development" })).resolves.toBe(false);
  });
});

describe("session stores", () => {
  test("creates, refreshes, and revokes platform sessions", () => {
    const store = new InMemorySessionStore({
      ttlSeconds: 60,
      idleTimeoutSeconds: 30,
      secret: "test-secret"
    });
    const created = store.create(1000);

    expect(store.get(created.token, 1000)?.id).toBe(created.record.id);
    expect(store.refresh(created.token, 2000)?.lastSeenAt).toBe(2000);

    store.revoke(created.token);
    expect(store.get(created.token, 3000)).toBeNull();
  });

  test("expires recent control authorization", () => {
    const store = new InMemoryControlAuthStore(5);
    const grant = store.grant("session-1", 1000);

    expect(grant.expiresAt).toBe(6000);
    expect(store.get("session-1", 5999)).not.toBeNull();
    expect(store.get("session-1", 6000)).toBeNull();
  });
});
