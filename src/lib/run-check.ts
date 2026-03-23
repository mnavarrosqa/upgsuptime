import { randomUUID } from "crypto";
import { lookup as dnsLookup } from "dns/promises";
import { fetch as undiciFetch, buildConnector, Agent } from "undici";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import { getUrlNotAllowedReason, isBlockedIP } from "@/lib/url-allowed";
import { sendNotifications, sendSslNotifications } from "@/lib/notify";
import type { SslAlertType } from "@/lib/notify";
import { checkSSL } from "@/lib/check-ssl";

export type RunCheckResult = {
  monitorId: string;
  ok: boolean;
  statusCode?: number;
  responseTimeMs: number;
  message?: string;
};

/** Number of consecutive failures required before transitioning to DOWN and alerting. */
const CONFIRMATION_COUNT = 2;

/**
 * Undici agent that re-validates resolved IPs at connect time, eliminating the
 * TOCTOU race between the pre-check in getUrlNotAllowedReason and the actual fetch.
 */
const defaultConnector = buildConnector({});
const ssrfGuardAgent = new Agent({
  connect: (options, callback) => {
    const hostname = (options as { hostname?: string }).hostname ?? "";
    dnsLookup(hostname, { all: true })
      .then((addresses) => {
        for (const { address } of addresses) {
          if (isBlockedIP(address)) {
            callback(new Error(`Resolved IP ${address} is not allowed (SSRF protection)`), null);
            return;
          }
        }
        defaultConnector(options, callback);
      })
      .catch((err: unknown) => {
        callback(err instanceof Error ? err : new Error(String(err)), null);
      });
  },
});

/** Total fetch attempts per check (1 initial + 2 retries). */
const TOTAL_ATTEMPTS = 3;
/** Delay between retry attempts in milliseconds. */
const RETRY_DELAY_MS = 1000;

/**
 * Parse expectedStatusCodes string into a predicate for status codes.
 * Supports: "200", "200,201", "200-299"
 */
function parseExpectedStatusCodes(value: string): (status: number) => boolean {
  const raw = (value ?? "200-299").trim();
  if (!raw) return (status) => status >= 200 && status < 300;

  const parts = raw.split(",").map((p) => p.trim());
  return (status: number) => {
    for (const part of parts) {
      if (part.includes("-")) {
        const [a, b] = part.split("-").map((s) => parseInt(s, 10));
        if (!Number.isNaN(a) && !Number.isNaN(b) && status >= a && status <= b)
          return true;
      } else {
        const code = parseInt(part, 10);
        if (!Number.isNaN(code) && status === code) return true;
      }
    }
    return false;
  };
}

/** Human-readable label for common HTTP status codes */
function httpStatusText(code: number): string {
  const texts: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    408: "Request Timeout",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return texts[code] ?? "HTTP error";
}

/** Days until a stored expiry date, or null */
function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Run a single uptime check for a monitor: fetch URL, record result, update lastCheckAt.
 * Detects status transitions (up↔down) and fires notifications when they occur.
 * If SSL monitoring is enabled, also checks the certificate and fires SSL alerts.
 */
export async function runCheck(m: Monitor, ownerEmail: string): Promise<RunCheckResult> {
  const now = new Date();
  const timeoutMs = Math.min(120, Math.max(5, m.timeoutSeconds ?? 15)) * 1000;
  const method = (m.method === "HEAD" ? "HEAD" : "GET") as "GET" | "HEAD";
  const isSuccess = parseExpectedStatusCodes(m.expectedStatusCodes ?? "200-299");

  let ok = false;
  let statusCode: number | undefined;
  let message: string | undefined;
  let responseTimeMs = 0;

  const notAllowedReason = await getUrlNotAllowedReason(m.url);
  if (notAllowedReason) {
    message = notAllowedReason;
  } else {
    for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

      const attemptStart = Date.now();
      ok = false;
      statusCode = undefined;
      message = undefined;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await undiciFetch(m.url, {
          method,
          signal: controller.signal,
          headers: { "User-Agent": "UPGSMonitor/1.0" },
          dispatcher: ssrfGuardAgent,
        });
        statusCode = res.status;
        ok = isSuccess(res.status);
        // Drain body so undici can reuse the connection
        await res.body?.cancel();
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
      }

      responseTimeMs = Date.now() - attemptStart;
      if (ok) break;
    }
  }

  // When HTTP check fails with a status code but no network error, add descriptive text
  if (!ok && statusCode != null && !message) {
    message = httpStatusText(statusCode);
  }

  // SSL check only when URL is allowed for HTTP (same SSRF policy); runs while we insert the check row
  const sslPromise =
    m.sslMonitoring && !notAllowedReason ? checkSSL(m.url, 10_000) : Promise.resolve(null);

  const id = randomUUID();
  await db.insert(checkResult).values({
    id,
    monitorId: m.id,
    statusCode: statusCode ?? null,
    responseTimeMs,
    ok,
    message: message ?? null,
    createdAt: now,
  });

  // --- Confirmation window state machine ---
  let newConsecutiveFailures: number;
  let shouldTransition: boolean;
  let shouldNotify: boolean;

  if (ok) {
    newConsecutiveFailures = 0;
    shouldTransition = m.currentStatus !== true;   // null→true or false→true
    shouldNotify = m.currentStatus === false;       // only false→true (recovery) alerts
  } else {
    newConsecutiveFailures = (m.consecutiveFailures ?? 0) + 1;
    if (newConsecutiveFailures >= CONFIRMATION_COUNT) {
      shouldTransition = m.currentStatus !== false; // null→false or true→false
      shouldNotify = m.currentStatus === true;      // only true→false fires DOWN alert
    } else {
      shouldTransition = false;
      shouldNotify = false;
    }
  }

  // True when a site that was confirmed down has just come back up
  const isHttpRecovery = m.currentStatus === false && ok === true;

  // Await SSL result (likely already done by now)
  const sslResult = await sslPromise;

  // Detect SSL alert type by comparing new state to stored values
  let sslAlertType: SslAlertType | null = null;
  if (sslResult) {
    const oldDays = daysUntil(m.sslExpiresAt);
    const newDays = sslResult.daysUntilExpiry;
    const wasValid = m.sslValid; // null = first ever SSL check

    if (!sslResult.valid && wasValid !== false) {
      // Just became invalid (or first check and already invalid)
      sslAlertType = "invalid";
    } else if (sslResult.valid && wasValid === false) {
      // Cert recovered
      sslAlertType = "recovered";
    } else if (sslResult.valid && newDays !== null) {
      // Check expiry threshold crossings — fire only when first crossing
      if (newDays <= 7 && (oldDays === null || oldDays > 7)) {
        sslAlertType = "critical";
      } else if (newDays <= 30 && (oldDays === null || oldDays > 30)) {
        sslAlertType = "expiring";
      }
    }
  }

  // Single DB update: HTTP fields + SSL fields + consecutiveFailures in one round-trip
  await db
    .update(monitor)
    .set({
      lastCheckAt: now,
      consecutiveFailures: newConsecutiveFailures,
      ...(shouldTransition ? { currentStatus: ok, lastStatusChangedAt: now } : {}),
      ...(sslResult
        ? {
            sslValid: sslResult.valid,
            sslExpiresAt: sslResult.expiresAt,
            sslLastCheckedAt: now,
          }
        : {}),
    })
    .where(sql`${monitor.id} = ${m.id}`);

  const result: RunCheckResult = {
    monitorId: m.id,
    ok,
    statusCode,
    responseTimeMs,
    message,
  };

  const mergeSslIntoDownEmail =
    Boolean(
      shouldNotify &&
        !ok &&
        sslResult &&
        sslAlertType &&
        sslAlertType !== "recovered"
    );

  // Fire-and-forget: notification errors must not propagate
  if (shouldNotify) {
    const sslForUptime =
      isHttpRecovery || mergeSslIntoDownEmail ? sslResult : null;
    const mergedSslAlertForDown = mergeSslIntoDownEmail ? sslAlertType : null;
    sendNotifications(
      m,
      ok,
      result,
      ownerEmail,
      sslForUptime,
      mergedSslAlertForDown
    ).catch((err) => {
      console.error("[run-check] notification error for monitor", m.id, err);
    });
  }
  // Skip separate SSL email when merged into UP recovery or into DOWN email
  if (
    sslResult &&
    sslAlertType &&
    !(sslAlertType === "recovered" && isHttpRecovery) &&
    !mergeSslIntoDownEmail
  ) {
    sendSslNotifications(m, sslResult, sslAlertType, ownerEmail).catch((err) => {
      console.error("[run-check] SSL notification error for monitor", m.id, err);
    });
  }

  return result;
}
