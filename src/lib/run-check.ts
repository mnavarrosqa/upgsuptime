import { randomUUID } from "crypto";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import { getUrlNotAllowedReason } from "@/lib/url-allowed";
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

  const start = Date.now();
  let ok = false;
  let statusCode: number | undefined;
  let message: string | undefined;

  const notAllowedReason = await getUrlNotAllowedReason(m.url);
  if (notAllowedReason) {
    message = notAllowedReason;
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(m.url, {
        method,
        signal: controller.signal,
        headers: { "User-Agent": "UPGSMonitor/1.0" },
      });
      clearTimeout(timeout);
      statusCode = res.status;
      ok = isSuccess(res.status);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
  }

  const responseTimeMs = Date.now() - start;

  // Start SSL check concurrently while we do the DB insert
  const sslPromise = m.sslMonitoring ? checkSSL(m.url, 10_000) : Promise.resolve(null);

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

  // Detect HTTP status transition: null (unknown) → any, or true → false, or false → true
  const transitioned = m.currentStatus === null || m.currentStatus !== ok;

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

  // Single DB update: HTTP fields + SSL fields in one round-trip
  await db
    .update(monitor)
    .set({
      lastCheckAt: now,
      ...(transitioned ? { currentStatus: ok, lastStatusChangedAt: now } : {}),
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

  // Fire-and-forget: notification errors must not propagate
  if (transitioned) {
    sendNotifications(m, ok, result, ownerEmail).catch((err) => {
      console.error("[run-check] notification error for monitor", m.id, err);
    });
  }
  if (sslResult && sslAlertType) {
    sendSslNotifications(m, sslResult, sslAlertType, ownerEmail).catch((err) => {
      console.error("[run-check] SSL notification error for monitor", m.id, err);
    });
  }

  return result;
}
