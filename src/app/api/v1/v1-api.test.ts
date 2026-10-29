import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const mocks = vi.hoisted(() => ({ db: null as unknown, getServerSession: vi.fn(), runCheck: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/run-check", () => ({ runCheck: mocks.runCheck }));
vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-v1");

import { checkResult, monitor, pushDevice, user } from "@/db/schema";
import { POST as tokenPOST } from "./auth/token/route";
import { POST as refreshPOST } from "./auth/refresh/route";
import { POST as logoutPOST } from "./auth/logout/route";
import { GET as meGET } from "./me/route";
import { GET as monitorsGET } from "./monitors/route";
import { GET as monitorGET, PATCH as monitorPATCH } from "./monitors/[id]/route";
import { GET as resultsGET } from "./monitors/[id]/results/route";
import { POST as checkPOST } from "./monitors/[id]/check/route";
import { DELETE as devicesDELETE, POST as devicesPOST } from "./devices/route";

let db: TestDb;
let ipCounter = 0;

function req(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": `10.9.0.${ipCounter}` };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function signIn(): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await tokenPOST(req("/api/v1/auth/token", { method: "POST", body: { login: "owner", password: "hunter22!", deviceName: "Pixel" } }));
  expect(res.status).toBe(200);
  return res.json();
}

beforeEach(async () => {
  ipCounter++;
  db = createTestDb();
  mocks.db = db;
  mocks.getServerSession.mockReset().mockResolvedValue(null);
  mocks.runCheck.mockReset();
  const now = new Date();
  await db.insert(user).values([
    { id: "user-1", email: "owner@example.com", username: "owner", language: "en", passwordHash: await bcrypt.hash("hunter22!", 4), role: "user", createdAt: now },
    { id: "user-2", email: "other@example.com", username: "other", language: "es", passwordHash: "x", role: "user", createdAt: now },
  ]);
  const base = {
    url: "https://example.com",
    intervalMinutes: 5,
    timeoutSeconds: 15,
    method: "GET" as const,
    expectedStatusCodes: "200-299",
    requestHeaders: JSON.stringify([{ name: "Authorization", value: "Bearer secret" }]),
    requestBodyType: "none" as const,
    followRedirects: true,
    maxRedirects: 20,
    type: "http" as const,
    createdAt: now,
  };
  await db.insert(monitor).values([
    { ...base, id: "m1", userId: "user-1", name: "Shop", currentStatus: false, lastStatusChangedAt: now },
    { ...base, id: "m2", userId: "user-1", name: "API", currentStatus: true },
    { ...base, id: "m3", userId: "user-2", name: "Not mine" },
  ]);
  await db.insert(checkResult).values(
    Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      monitorId: "m1",
      ok: i !== 0,
      statusCode: i === 0 ? 503 : 200,
      responseTimeMs: 100 + i,
      createdAt: new Date(now.getTime() - i * 60_000),
    })),
  );
});

describe("/api/v1 auth", () => {
  it("issues tokens for valid credentials and rejects bad ones", async () => {
    const tokens = await signIn();
    expect(tokens).toMatchObject({ tokenType: "Bearer", accessToken: expect.any(String), refreshToken: expect.stringMatching(/^upg_rt_/) });

    const bad = await tokenPOST(req("/api/v1/auth/token", { method: "POST", body: { login: "owner", password: "nope" } }));
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ errorCode: "INVALID_CREDENTIALS" });
  });

  it("rate-limits repeated sign-in attempts", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await tokenPOST(req("/api/v1/auth/token", { method: "POST", body: { login: "owner", password: "nope" } }));
    }
    expect(last?.status).toBe(429);
  });

  it("returns the user for a bearer token and 401 without one", async () => {
    const { accessToken } = await signIn();

    const me = await meGET(req("/api/v1/me", { token: accessToken }));
    expect(await me.json()).toEqual({ id: "user-1", email: "owner@example.com", username: "owner", role: "user", language: "en" });
    expect((await meGET(req("/api/v1/me"))).status).toBe(401);
    expect((await meGET(req("/api/v1/me", { token: "bogus" }))).status).toBe(401);
  });

  it("does not fall back to the cookie session when a bearer token is invalid", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-1", email: "owner@example.com" } });

    expect((await meGET(req("/api/v1/me", { token: "bogus" }))).status).toBe(401);
    expect((await meGET(req("/api/v1/me"))).status).toBe(200);
  });

  it("refreshes and signs out", async () => {
    const { refreshToken } = await signIn();

    const refreshed = await refreshPOST(req("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } }));
    const next = await refreshed.json();
    expect(refreshed.status).toBe(200);

    const reused = await refreshPOST(req("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } }));
    expect(reused.status).toBe(401);

    const again = await signIn();
    expect((await logoutPOST(req("/api/v1/auth/logout", { method: "POST", token: again.accessToken }))).status).toBe(204);
    expect((await meGET(req("/api/v1/me", { token: again.accessToken }))).status).toBe(401);
    expect(next.accessToken).toBeTruthy();
  });
});

describe("/api/v1 monitors", () => {
  it("lists only the user's monitors with latest check and uptime", async () => {
    const { accessToken } = await signIn();

    const body = await (await monitorsGET(req("/api/v1/monitors", { token: accessToken }))).json();

    expect(body.monitors.map((m: { id: string }) => m.id)).toEqual(["m2", "m1"]);
    const shop = body.monitors.find((m: { id: string }) => m.id === "m1");
    expect(shop).toMatchObject({
      status: "down",
      latestCheck: { ok: false, responseTimeMs: 100 },
      uptime90dPct: 80,
    });
  });

  it("returns monitor detail with secret header values redacted, and 404 for others' monitors", async () => {
    const { accessToken } = await signIn();

    const detail = await (await monitorGET(req("/api/v1/monitors/m1", { token: accessToken }), params("m1"))).json();
    expect(detail.requestHeaders).toEqual([{ name: "Authorization", value: "[redacted]" }]);
    expect(JSON.stringify(detail)).not.toContain("secret");

    expect((await monitorGET(req("/api/v1/monitors/m3", { token: accessToken }), params("m3"))).status).toBe(404);
  });

  it("pauses a monitor and rejects other fields", async () => {
    const { accessToken } = await signIn();

    const paused = await monitorPATCH(req("/api/v1/monitors/m2", { method: "PATCH", token: accessToken, body: { paused: true } }), params("m2"));
    expect(await paused.json()).toMatchObject({ id: "m2", paused: true, status: "paused" });

    const rejected = await monitorPATCH(req("/api/v1/monitors/m2", { method: "PATCH", token: accessToken, body: { url: "https://evil.test" } }), params("m2"));
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).errorCode).toBe("UNSUPPORTED_FIELD");
  });

  it("pages through check results with a cursor", async () => {
    const { accessToken } = await signIn();

    const first = await (await resultsGET(req("/api/v1/monitors/m1/results?limit=3", { token: accessToken }), params("m1"))).json();
    expect(first.results.map((r: { id: string }) => r.id)).toEqual(["r0", "r1", "r2"]);
    expect(first.nextBefore).toEqual(expect.any(String));

    const second = await (
      await resultsGET(req(`/api/v1/monitors/m1/results?limit=3&before=${encodeURIComponent(first.nextBefore)}`, { token: accessToken }), params("m1"))
    ).json();
    expect(second.results.map((r: { id: string }) => r.id)).toEqual(["r3", "r4"]);
    expect(second.nextBefore).toBeNull();
  });

  it("runs a manual check as the owner", async () => {
    const { accessToken } = await signIn();
    mocks.runCheck.mockResolvedValue({ monitorId: "m1", ok: true, statusCode: 200, responseTimeMs: 90, timings: { dnsMs: 3 }, attempts: 1 });

    const res = await checkPOST(req("/api/v1/monitors/m1/check", { method: "POST", token: accessToken }), params("m1"));

    expect(await res.json()).toMatchObject({ ok: true, statusCode: 200, timings: { dnsMs: 3, connectMs: null } });
    expect(mocks.runCheck).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), { email: "owner@example.com", language: "en" }, { maintenanceActive: false, manual: true });
  });
});

describe("/api/v1 devices", () => {
  it("registers a device to the session and removes it on sign-out", async () => {
    const { accessToken } = await signIn();

    const created = await devicesPOST(req("/api/v1/devices", { method: "POST", token: accessToken, body: { token: "fcm-abc", platform: "android" } }));
    expect(created.status).toBe(201);
    const again = await devicesPOST(req("/api/v1/devices", { method: "POST", token: accessToken, body: { token: "fcm-abc" } }));
    expect(again.status).toBe(200);
    expect(await db.select().from(pushDevice)).toHaveLength(1);

    await logoutPOST(req("/api/v1/auth/logout", { method: "POST", token: accessToken }));
    expect(await db.select().from(pushDevice)).toHaveLength(0);
  });

  it("requires an app token and lets users remove only their own devices", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-1", email: "owner@example.com" } });
    const cookieOnly = await devicesPOST(req("/api/v1/devices", { method: "POST", body: { token: "fcm-x" } }));
    expect(cookieOnly.status).toBe(403);

    const now = new Date();
    await db.insert(pushDevice).values({ id: "d9", userId: "user-2", token: "fcm-other", createdAt: now, lastSeenAt: now });
    const { accessToken } = await signIn();
    await devicesDELETE(req("/api/v1/devices", { method: "DELETE", token: accessToken, body: { token: "fcm-other" } }));
    expect(await db.select().from(pushDevice)).toHaveLength(1);
  });
});
