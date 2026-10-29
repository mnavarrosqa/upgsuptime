import { createSign } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushDevice, type Monitor } from "@/db/schema";
import type { AppLocale } from "@/i18n/config";
import { getEmailMessages } from "@/lib/email-i18n";
import type { RunCheckResult } from "@/lib/run-check";
import { uptimeAlertSubject } from "@/lib/notify";

/**
 * Push notifications through Firebase Cloud Messaging (HTTP v1 API).
 * Configure with FCM_SERVICE_ACCOUNT_JSON (the service account key file contents);
 * without it every send is a no-op.
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Android notification channel the app must create for alerts. */
export const ANDROID_ALERT_CHANNEL_ID = "monitor_alerts";

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

export type PushMessage = {
  title: string;
  body: string;
  /** String-only key/values delivered to the app (FCM requires strings). */
  data: Record<string, string>;
};

export function readServiceAccount(raw = process.env.FCM_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Keys pasted into env files often carry literal "\n" sequences.
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    console.error("[push] FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

function isPushConfigured(): boolean {
  return readServiceAccount() !== null;
}

let cachedAccessToken: { token: string; expiresAt: number; clientEmail: string } | null = null;

/** OAuth access token for FCM via a signed service-account JWT (cached until shortly before expiry). */
async function getAccessToken(account: ServiceAccount, now = Date.now()): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.clientEmail === account.clientEmail && cachedAccessToken.expiresAt - 60_000 > now) {
    return cachedAccessToken.token;
  }
  const iat = Math.floor(now / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.clientEmail,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey, "base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FCM auth failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: body.access_token,
    expiresAt: now + body.expires_in * 1000,
    clientEmail: account.clientEmail,
  };
  return body.access_token;
}

/** FCM answers these for tokens that will never work again (app uninstalled, token rotated). */
function isDeadTokenError(status: number, body: unknown): boolean {
  if (status === 404) return true;
  const details = (body as { error?: { details?: Array<{ errorCode?: string }> } })?.error?.details ?? [];
  return details.some((d) => d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT");
}

async function sendToToken(
  account: ServiceAccount,
  accessToken: string,
  token: string,
  message: PushMessage,
): Promise<"sent" | "dead" | "failed"> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { priority: "high", notification: { channel_id: ANDROID_ALERT_CHANNEL_ID } },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return "sent";
  const body = await res.json().catch(() => null);
  if (isDeadTokenError(res.status, body)) return "dead";
  console.error("[push] FCM send failed", res.status, JSON.stringify(body)?.slice(0, 300));
  return "failed";
}

/** Sends a notification to every device the user registered; drops tokens FCM rejects for good. */
export async function sendPushToUser(
  userId: string,
  message: PushMessage,
): Promise<{ sent: number; removed: number; failed: number }> {
  const account = readServiceAccount();
  if (!account) return { sent: 0, removed: 0, failed: 0 };

  const devices = await db
    .select({ id: pushDevice.id, token: pushDevice.token })
    .from(pushDevice)
    .where(eq(pushDevice.userId, userId));
  if (devices.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const accessToken = await getAccessToken(account);
  const outcomes = await Promise.all(
    devices.map((d) =>
      sendToToken(account, accessToken, d.token, message).catch((err) => {
        console.error("[push] FCM send error", err);
        return "failed" as const;
      }),
    ),
  );

  const deadIds = devices.filter((_, i) => outcomes[i] === "dead").map((d) => d.id);
  if (deadIds.length > 0) await db.delete(pushDevice).where(inArray(pushDevice.id, deadIds));
  return {
    sent: outcomes.filter((o) => o === "sent").length,
    removed: deadIds.length,
    failed: outcomes.filter((o) => o === "failed").length,
  };
}

/** Push for a confirmed down/recovery transition, worded like the alert email. */
export async function sendMonitorStatusPush(
  m: Pick<Monitor, "id" | "userId" | "name" | "type">,
  newStatus: boolean,
  result: Pick<RunCheckResult, "message" | "statusCode">,
  locale: AppLocale,
): Promise<void> {
  if (!isPushConfigured()) return;
  const messages = await getEmailMessages(locale);
  const body = newStatus
    ? messages.statusUp
    : result.message ?? (result.statusCode != null ? `HTTP ${result.statusCode}` : messages.statusDown);
  await sendPushToUser(m.userId, {
    title: uptimeAlertSubject(m, newStatus, messages),
    body,
    data: {
      type: "monitor_status",
      monitorId: m.id,
      status: newStatus ? "up" : "down",
    },
  });
}

/** Test hook: forget the cached OAuth token. */
export function resetPushAuthCache(): void {
  cachedAccessToken = null;
}
