import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { webPushSubscription } from "@/db/schema";

/**
 * Web Push (browser and installed PWA notifications) with VAPID.
 * Configure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (`npx web-push generate-vapid-keys`);
 * without them the feature is off and the UI hides the toggle.
 */

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export type WebPushPayload = {
  title: string;
  body: string;
  /** Path to open when the notification is clicked. */
  url: string;
  /** Notifications with the same tag replace each other (one per monitor). */
  tag?: string;
};

export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Push services require a contact: a mailto: or https: URL.
  const appUrl = process.env.NEXTAUTH_URL?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    (appUrl?.startsWith("https://") ? appUrl : "mailto:admin@localhost");
  return { publicKey, privateKey, subject };
}

/** Public key the browser needs to subscribe, or null when Web Push is not configured. */
export function getWebPushPublicKey(): string | null {
  return readVapidConfig()?.publicKey ?? null;
}

/** Push services used by Chrome/Edge/Android, Firefox, Safari/iOS and legacy Edge. */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "push.apple.com",
  "notify.windows.com",
];

function isKnownPushService(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Validates the JSON a browser's `PushSubscription.toJSON()` produces. */
export function parseBrowserSubscription(input: unknown): BrowserSubscription | null {
  if (!input || typeof input !== "object") return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // The server POSTs to this URL, so only accept the browsers' real push services.
  if (url.protocol !== "https:" || !isKnownPushService(url.hostname)) return null;
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return null;
  if (keys.p256dh.length > 256 || keys.auth.length > 64) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Stores (or re-assigns) a browser subscription for the user. */
export async function saveWebPushSubscription(
  userId: string,
  subscription: BrowserSubscription,
  userAgent: string | null,
): Promise<void> {
  const now = new Date();
  const values = {
    userId,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent?.slice(0, 300) ?? null,
    lastSeenAt: now,
  };
  const [existing] = await db
    .select({ id: webPushSubscription.id })
    .from(webPushSubscription)
    .where(eq(webPushSubscription.endpoint, subscription.endpoint));
  if (existing) {
    await db.update(webPushSubscription).set(values).where(eq(webPushSubscription.id, existing.id));
    return;
  }
  await db.insert(webPushSubscription).values({
    id: randomUUID(),
    endpoint: subscription.endpoint,
    createdAt: now,
    ...values,
  });
}

export async function deleteWebPushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(webPushSubscription)
    .where(and(eq(webPushSubscription.userId, userId), eq(webPushSubscription.endpoint, endpoint)));
}

/** Sends to every browser the user subscribed; drops subscriptions the push service says are gone. */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload,
  onlyEndpoint?: string,
): Promise<{ sent: number; removed: number; failed: number }> {
  const vapid = readVapidConfig();
  if (!vapid) return { sent: 0, removed: 0, failed: 0 };

  const subscriptions = await db
    .select()
    .from(webPushSubscription)
    .where(
      onlyEndpoint
        ? and(eq(webPushSubscription.userId, userId), eq(webPushSubscription.endpoint, onlyEndpoint))
        : eq(webPushSubscription.userId, userId),
    );

  const outcomes = await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          {
            vapidDetails: vapid,
            TTL: 60 * 60,
            urgency: "high",
            topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
          },
        );
        return "sent" as const;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "gone" as const;
        console.error("[web-push] send failed", status ?? err);
        return "failed" as const;
      }
    }),
  );

  const gone = subscriptions.filter((_, i) => outcomes[i] === "gone");
  for (const s of gone) {
    await db.delete(webPushSubscription).where(eq(webPushSubscription.id, s.id));
  }
  return {
    sent: outcomes.filter((o) => o === "sent").length,
    removed: gone.length,
    failed: outcomes.filter((o) => o === "failed").length,
  };
}
