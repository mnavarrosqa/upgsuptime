import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const mocks = vi.hoisted(() => ({ db: null as unknown, sendNotification: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification } }));

import { user, webPushSubscription } from "@/db/schema";
import {
  deleteWebPushSubscription,
  getWebPushPublicKey,
  parseBrowserSubscription,
  saveWebPushSubscription,
  sendWebPushToUser,
} from "./web-push";

let db: TestDb;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const chrome = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys };
const firefox = { endpoint: "https://updates.push.services.mozilla.com/wpush/v2/xyz", keys };

beforeEach(async () => {
  db = createTestDb();
  mocks.db = db;
  mocks.sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  vi.stubEnv("VAPID_PUBLIC_KEY", "BPublicKey");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privateKey");
  vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.com");
  const now = new Date();
  await db.insert(user).values([
    { id: "user-1", email: "a@example.com", language: "es", passwordHash: "x", role: "user", createdAt: now },
    { id: "user-2", email: "b@example.com", language: "en", passwordHash: "x", role: "user", createdAt: now },
  ]);
});

afterEach(() => vi.unstubAllEnvs());

describe("parseBrowserSubscription", () => {
  it("accepts subscriptions from the browsers' push services", () => {
    expect(parseBrowserSubscription(chrome)).toEqual(chrome);
    expect(parseBrowserSubscription(firefox)).toEqual(firefox);
    expect(parseBrowserSubscription({ ...chrome, endpoint: "https://web.push.apple.com/QGuQyavXut" })).not.toBeNull();
    expect(parseBrowserSubscription({ ...chrome, endpoint: "https://wns2-par02p.notify.windows.com/w/?token=1" })).not.toBeNull();
  });

  it("rejects endpoints that are not a known push service", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x",
      "not a url",
    ]) {
      expect(parseBrowserSubscription({ endpoint, keys })).toBeNull();
    }
    expect(parseBrowserSubscription({ endpoint: chrome.endpoint })).toBeNull();
    expect(parseBrowserSubscription(null)).toBeNull();
  });
});

describe("subscriptions", () => {
  it("re-registering an endpoint moves it instead of duplicating", async () => {
    await saveWebPushSubscription("user-1", chrome, "Chrome");
    await saveWebPushSubscription("user-2", chrome, "Chrome");

    const rows = await db.select().from(webPushSubscription);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user-2");
  });

  it("lets users delete only their own subscriptions", async () => {
    await saveWebPushSubscription("user-1", chrome, null);

    await deleteWebPushSubscription("user-2", chrome.endpoint);
    expect(await db.select().from(webPushSubscription)).toHaveLength(1);
    await deleteWebPushSubscription("user-1", chrome.endpoint);
    expect(await db.select().from(webPushSubscription)).toHaveLength(0);
  });
});

describe("sendWebPushToUser", () => {
  it("sends the JSON payload with VAPID details to each subscription", async () => {
    await saveWebPushSubscription("user-1", chrome, null);
    await saveWebPushSubscription("user-1", firefox, null);

    const outcome = await sendWebPushToUser("user-1", { title: "Caído", body: "HTTP 503", url: "/monitors/m1", tag: "monitor-m1" });

    expect(outcome).toEqual({ sent: 2, removed: 0, failed: 0 });
    const [subscription, payload, options] = mocks.sendNotification.mock.calls[0];
    expect(subscription).toEqual(chrome);
    expect(JSON.parse(payload)).toEqual({ title: "Caído", body: "HTTP 503", url: "/monitors/m1", tag: "monitor-m1" });
    expect(options).toMatchObject({
      vapidDetails: { publicKey: "BPublicKey", privateKey: "privateKey", subject: "mailto:ops@example.com" },
      urgency: "high",
      topic: "monitor-m1",
    });
  });

  it("can target a single browser", async () => {
    await saveWebPushSubscription("user-1", chrome, null);
    await saveWebPushSubscription("user-1", firefox, null);

    await sendWebPushToUser("user-1", { title: "t", body: "b", url: "/" }, firefox.endpoint);

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification.mock.calls[0][0].endpoint).toBe(firefox.endpoint);
  });

  it("removes subscriptions the push service reports as gone", async () => {
    await saveWebPushSubscription("user-1", chrome, null);
    await saveWebPushSubscription("user-1", firefox, null);
    mocks.sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === chrome.endpoint) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });

    const outcome = await sendWebPushToUser("user-1", { title: "t", body: "b", url: "/" });

    expect(outcome).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect((await db.select().from(webPushSubscription)).map((r) => r.endpoint)).toEqual([firefox.endpoint]);
  });

  it("keeps subscriptions on transient errors", async () => {
    await saveWebPushSubscription("user-1", chrome, null);
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error("busy"), { statusCode: 503 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendWebPushToUser("user-1", { title: "t", body: "b", url: "/" })).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(await db.select().from(webPushSubscription)).toHaveLength(1);
  });

  it("is off without VAPID keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await saveWebPushSubscription("user-1", chrome, null);

    expect(getWebPushPublicKey()).toBeNull();
    expect(await sendWebPushToUser("user-1", { title: "t", body: "b", url: "/" })).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
