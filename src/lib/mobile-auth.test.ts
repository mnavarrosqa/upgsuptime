import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-mobile-auth");

import { mobileSession, pushDevice, user } from "@/db/schema";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  authenticateMobileRequest,
  createMobileSession,
  refreshMobileSession,
  revokeAllMobileSessions,
  revokeMobileSession,
  signAccessToken,
  verifyAccessToken,
} from "./mobile-auth";

let db: TestDb;

function bearer(token: string) {
  return new Request("http://localhost/api/v1/me", { headers: { Authorization: `Bearer ${token}` } });
}

beforeEach(async () => {
  db = createTestDb();
  holder.db = db;
  await db.insert(user).values({
    id: "user-1",
    email: "owner@example.com",
    username: "owner",
    language: "en",
    passwordHash: "x",
    role: "user",
    createdAt: new Date(),
  });
});

describe("access tokens", () => {
  it("round-trips user and session ids", () => {
    const { token } = signAccessToken("user-1", "session-1");
    expect(verifyAccessToken(token)).toEqual({ userId: "user-1", sessionId: "session-1" });
  });

  it("rejects expired, tampered and foreign tokens", () => {
    const issuedAt = new Date("2026-01-01T00:00:00Z");
    const { token } = signAccessToken("user-1", "session-1", issuedAt);
    const afterExpiry = new Date(issuedAt.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    expect(verifyAccessToken(token, afterExpiry)).toBeNull();

    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "admin", sid: "session-1", typ: "access", iat: 0, exp: 9999999999 }),
    ).toString("base64url");
    expect(verifyAccessToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();

    const noneAlg = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${forgedPayload}.`;
    expect(verifyAccessToken(noneAlg)).toBeNull();
    expect(verifyAccessToken("not-a-token")).toBeNull();
  });
});

describe("mobile sessions", () => {
  it("authenticates requests with a fresh access token", async () => {
    const tokens = await createMobileSession("user-1", "Pixel 9");

    const authed = await authenticateMobileRequest(bearer(tokens.accessToken));

    expect(authed).toMatchObject({ id: "user-1", email: "owner@example.com", language: "en", sessionId: tokens.sessionId });
    const [row] = await db.select().from(mobileSession);
    expect(row.deviceName).toBe("Pixel 9");
    expect(row.refreshTokenHash).not.toContain(tokens.refreshToken);
  });

  it("rotates refresh tokens and invalidates the previous one", async () => {
    const first = await createMobileSession("user-1", null);

    const refreshed = await refreshMobileSession(first.refreshToken);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.tokens.refreshToken).not.toBe(first.refreshToken);
    expect(refreshed.tokens.sessionId).toBe(first.sessionId);

    const again = await refreshMobileSession(refreshed.tokens.refreshToken);
    expect(again.ok).toBe(true);
  });

  it("revokes the session when a replaced refresh token is reused", async () => {
    const first = await createMobileSession("user-1", null);
    const refreshed = await refreshMobileSession(first.refreshToken);
    if (!refreshed.ok) throw new Error("refresh failed");

    expect(await refreshMobileSession(first.refreshToken)).toEqual({ ok: false, reason: "reused" });
    // The legitimate holder is signed out too: the session is gone.
    expect(await refreshMobileSession(refreshed.tokens.refreshToken)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticateMobileRequest(bearer(refreshed.tokens.accessToken))).toBeNull();
  });

  it("refuses expired refresh tokens", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const tokens = await createMobileSession("user-1", null, createdAt);

    const result = await refreshMobileSession(tokens.refreshToken, new Date("2026-06-01T00:00:00Z"));

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses to refresh sessions of deleted accounts", async () => {
    const tokens = await createMobileSession("user-1", null);
    db.$client.pragma("foreign_keys = OFF");
    await db.delete(user);

    expect(await refreshMobileSession(tokens.refreshToken)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticateMobileRequest(bearer(tokens.accessToken))).toBeNull();
  });

  it("rejects unknown refresh tokens", async () => {
    expect(await refreshMobileSession("upg_rt_unknown")).toEqual({ ok: false, reason: "invalid" });
    expect(await refreshMobileSession("garbage")).toEqual({ ok: false, reason: "invalid" });
  });

  it("signs a device out and removes its push registrations", async () => {
    const tokens = await createMobileSession("user-1", null);
    const other = await createMobileSession("user-1", null);
    const now = new Date();
    await db.insert(pushDevice).values([
      { id: "d1", userId: "user-1", sessionId: tokens.sessionId, token: "fcm-1", createdAt: now, lastSeenAt: now },
      { id: "d2", userId: "user-1", sessionId: other.sessionId, token: "fcm-2", createdAt: now, lastSeenAt: now },
    ]);

    await revokeMobileSession(tokens.sessionId);

    expect(await authenticateMobileRequest(bearer(tokens.accessToken))).toBeNull();
    expect(await refreshMobileSession(tokens.refreshToken)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticateMobileRequest(bearer(other.accessToken))).not.toBeNull();
    expect((await db.select().from(pushDevice)).map((d) => d.id)).toEqual(["d2"]);
  });

  it("signs every device out at once", async () => {
    const a = await createMobileSession("user-1", null);
    const b = await createMobileSession("user-1", null);

    await revokeAllMobileSessions("user-1");

    expect(await authenticateMobileRequest(bearer(a.accessToken))).toBeNull();
    expect(await authenticateMobileRequest(bearer(b.accessToken))).toBeNull();
  });

  it("ignores requests without a bearer token", async () => {
    expect(await authenticateMobileRequest(new Request("http://localhost"))).toBeNull();
  });
});
