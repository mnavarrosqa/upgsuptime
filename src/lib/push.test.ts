import { generateKeyPairSync } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const holder = vi.hoisted(() => ({ db: null as unknown, sendWebPush: vi.fn() }));
vi.mock("web-push", () => ({ default: { sendNotification: holder.sendWebPush } }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { pushDevice, user, webPushSubscription } from "@/db/schema";
import { ANDROID_ALERT_CHANNEL_ID, readServiceAccount, resetPushAuthCache, sendMonitorStatusPush, sendPushToUser } from "./push";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  project_id: "upg-test",
  client_email: "push@upg-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n"),
});

let db: TestDb;
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function addDevice(id: string, token: string) {
  const now = new Date();
  await db.insert(pushDevice).values({ id, userId: "user-1", token, createdAt: now, lastSeenAt: now });
}

function sendCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("fcm.googleapis.com"));
}

beforeEach(async () => {
  db = createTestDb();
  holder.db = db;
  await db.insert(user).values({
    id: "user-1",
    email: "owner@example.com",
    language: "es",
    passwordHash: "x",
    role: "user",
    createdAt: new Date(),
  });
  resetPushAuthCache();
  vi.stubEnv("FCM_SERVICE_ACCOUNT_JSON", serviceAccount);
  fetchMock.mockReset().mockImplementation(async (url: string) =>
    url === "https://oauth2.googleapis.com/token"
      ? jsonResponse({ access_token: "ya29.test", expires_in: 3600 })
      : jsonResponse({ name: "projects/upg-test/messages/1" }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("readServiceAccount", () => {
  it("parses the key file and unescapes the private key", () => {
    const account = readServiceAccount(serviceAccount);
    expect(account?.projectId).toBe("upg-test");
    expect(account?.privateKey).toContain("-----BEGIN PRIVATE KEY-----\n");
  });

  it("returns null when unset or incomplete", () => {
    expect(readServiceAccount("")).toBeNull();
    expect(readServiceAccount('{"project_id":"x"}')).toBeNull();
  });
});

describe("sendPushToUser", () => {
  it("does nothing when FCM is not configured", async () => {
    vi.stubEnv("FCM_SERVICE_ACCOUNT_JSON", "");
    await addDevice("d1", "fcm-1");

    expect(await sendPushToUser("user-1", { title: "t", body: "b", data: {} })).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticates with a signed service-account JWT and sends to each device", async () => {
    await addDevice("d1", "fcm-1");
    await addDevice("d2", "fcm-2");

    const outcome = await sendPushToUser("user-1", { title: "Down", body: "HTTP 503", data: { monitorId: "m1" } });

    expect(outcome).toEqual({ sent: 2, removed: 0, failed: 0 });
    const [, authInit] = fetchMock.mock.calls[0];
    const assertion = new URLSearchParams(authInit.body).get("assertion") ?? "";
    const claims = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString());
    expect(claims).toMatchObject({
      iss: "push@upg-test.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });

    const [url, init] = sendCalls()[0];
    expect(url).toBe("https://fcm.googleapis.com/v1/projects/upg-test/messages:send");
    expect(init.headers.Authorization).toBe("Bearer ya29.test");
    expect(JSON.parse(init.body).message).toEqual({
      token: "fcm-1",
      notification: { title: "Down", body: "HTTP 503" },
      data: { monitorId: "m1" },
      android: { priority: "high", notification: { channel_id: ANDROID_ALERT_CHANNEL_ID } },
    });
  });

  it("reuses the OAuth token across sends", async () => {
    await addDevice("d1", "fcm-1");

    await sendPushToUser("user-1", { title: "a", body: "b", data: {} });
    await sendPushToUser("user-1", { title: "a", body: "b", data: {} });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"))).toHaveLength(1);
  });

  it("removes devices whose token FCM reports as unregistered", async () => {
    await addDevice("d1", "fcm-dead");
    await addDevice("d2", "fcm-live");
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2")) return jsonResponse({ access_token: "ya29.test", expires_in: 3600 });
      const token = JSON.parse(String(init?.body)).message.token;
      return token === "fcm-dead"
        ? jsonResponse({ error: { code: 404, status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }, 404)
        : jsonResponse({ name: "ok" });
    });

    const outcome = await sendPushToUser("user-1", { title: "a", body: "b", data: {} });

    expect(outcome).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect((await db.select().from(pushDevice)).map((d) => d.token)).toEqual(["fcm-live"]);
  });

  it("keeps devices on transient errors", async () => {
    await addDevice("d1", "fcm-1");
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("oauth2")
        ? jsonResponse({ access_token: "ya29.test", expires_in: 3600 })
        : jsonResponse({ error: { code: 503, status: "UNAVAILABLE" } }, 503),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await sendPushToUser("user-1", { title: "a", body: "b", data: {} });

    expect(outcome).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(await db.select().from(pushDevice)).toHaveLength(1);
  });
});

describe("sendMonitorStatusPush", () => {
  it("words the alert like the email in the owner's language", async () => {
    await addDevice("d1", "fcm-1");

    await sendMonitorStatusPush(
      { id: "m1", userId: "user-1", name: "Tienda", type: "http" },
      false,
      { message: "Service Unavailable", statusCode: 503 },
      "es",
    );

    const message = JSON.parse(sendCalls()[0][1].body).message;
    expect(message.notification).toEqual({ title: "[Caído] Tienda — inalcanzable", body: "Service Unavailable" });
    expect(message.data).toEqual({ type: "monitor_status", monitorId: "m1", status: "down" });
  });

  it("sends recoveries", async () => {
    await addDevice("d1", "fcm-1");

    await sendMonitorStatusPush({ id: "m1", userId: "user-1", name: "Shop", type: "http" }, true, {}, "en");

    const message = JSON.parse(sendCalls()[0][1].body).message;
    expect(message.notification.title).toContain("Shop");
    expect(message.data.status).toBe("up");
  });

  it("also notifies subscribed browsers via Web Push, even without FCM", async () => {
    vi.stubEnv("FCM_SERVICE_ACCOUNT_JSON", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", "BPublicKey");
    vi.stubEnv("VAPID_PRIVATE_KEY", "privateKey");
    holder.sendWebPush.mockReset().mockResolvedValue({ statusCode: 201 });
    const now = new Date();
    await db.insert(webPushSubscription).values({
      id: "w1",
      userId: "user-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: "p",
      auth: "a",
      createdAt: now,
      lastSeenAt: now,
    });

    await sendMonitorStatusPush({ id: "m1", userId: "user-1", name: "Tienda", type: "http" }, false, { message: "Service Unavailable" }, "es");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(holder.sendWebPush.mock.calls[0][1])).toEqual({
      title: "[Caído] Tienda — inalcanzable",
      body: "Service Unavailable",
      url: "/monitors/m1",
      tag: "monitor-m1",
    });
  });
});
