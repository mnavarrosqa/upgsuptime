import { randomUUID } from "crypto";
import { lookup as dnsLookup, resolve as dnsResolve } from "dns/promises";
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
/** Maximum body bytes to read for keyword checks (2 MB). */
const KEYWORD_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

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

// ─── Shared state machine ─────────────────────────────────────────────────────

/**
 * Applies a raw check result to the DB state machine, updates the monitor row,
 * and fires notifications on status transitions. Returns the RunCheckResult.
 */
async function applyCheckResult(
  m: Monitor,
  ok: boolean,
  statusCode: number | undefined,
  responseTimeMs: number,
  message: string | undefined,
  sslPromise: Promise<import("@/lib/check-ssl").SslCheckResult | null>,
  ownerEmail: string
): Promise<RunCheckResult> {
  const now = new Date();

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

  // Await SSL result (likely already done by now); DNS monitors always pass null
  const sslResult = await sslPromise;

  // Detect SSL alert type by comparing new state to stored values
  let sslAlertType: SslAlertType | null = null;
  if (sslResult) {
    const oldDays = daysUntil(m.sslExpiresAt);
    const newDays = sslResult.daysUntilExpiry;
    const wasValid = m.sslValid; // null = first ever SSL check

    if (!sslResult.valid && wasValid !== false) {
      sslAlertType = "invalid";
    } else if (sslResult.valid && wasValid === false) {
      sslAlertType = "recovered";
    } else if (sslResult.valid && newDays !== null) {
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

// ─── HTTP check ───────────────────────────────────────────────────────────────

async function runCheckHttp(m: Monitor, ownerEmail: string): Promise<RunCheckResult> {
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
          headers: { "User-Agent": "UPGMonitor/1.0" },
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

  if (!ok && statusCode != null && !message) {
    message = httpStatusText(statusCode);
  }

  // SSL check runs in parallel (only when URL is allowed and type is not dns)
  const sslPromise =
    m.sslMonitoring && !notAllowedReason
      ? checkSSL(m.url, 10_000)
      : Promise.resolve(null);

  return applyCheckResult(m, ok, statusCode, responseTimeMs, message, sslPromise, ownerEmail);
}

// ─── Keyword check ────────────────────────────────────────────────────────────

async function runCheckKeyword(m: Monitor, ownerEmail: string): Promise<RunCheckResult> {
  const timeoutMs = Math.min(120, Math.max(5, m.timeoutSeconds ?? 15)) * 1000;
  const isSuccess = parseExpectedStatusCodes(m.expectedStatusCodes ?? "200-299");
  const keyword = (m.keywordContains ?? "").toLowerCase();
  const shouldExist = m.keywordShouldExist !== false; // default true

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
          method: "GET", // keyword monitors always use GET
          signal: controller.signal,
          headers: { "User-Agent": "UPGMonitor/1.0" },
          dispatcher: ssrfGuardAgent,
        });
        statusCode = res.status;
        const statusOk = isSuccess(res.status);

        // Read body up to KEYWORD_BODY_LIMIT_BYTES
        let bodyText = "";
        if (res.body) {
          const reader = res.body.getReader();
          let bytesRead = 0;
          const chunks: Uint8Array[] = [];
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytesRead += value.byteLength;
              if (bytesRead > KEYWORD_BODY_LIMIT_BYTES) {
                await reader.cancel();
                break;
              }
              chunks.push(value);
            }
          } catch {
            // partial read is fine — work with what we have
          }
          if (chunks.length > 0) {
            const total = chunks.reduce((acc, c) => acc + c.length, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            bodyText = new TextDecoder().decode(merged);
          }
        } else {
          // No body — nothing to drain
        }

        const found = bodyText.toLowerCase().includes(keyword);
        const keywordOk = shouldExist ? found : !found;
        ok = statusOk && keywordOk;

        if (!statusOk) {
          message = httpStatusText(statusCode);
        } else if (!keywordOk) {
          message = shouldExist
            ? `Keyword "${m.keywordContains}" not found in response`
            : `Keyword "${m.keywordContains}" found in response (expected absent)`;
        }
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
      }

      responseTimeMs = Date.now() - attemptStart;
      if (ok) break;
    }
  }

  // SSL check in parallel (keyword monitors can be HTTPS)
  const sslPromise =
    m.sslMonitoring && !notAllowedReason
      ? checkSSL(m.url, 10_000)
      : Promise.resolve(null);

  return applyCheckResult(m, ok, statusCode, responseTimeMs, message, sslPromise, ownerEmail);
}

// ─── DNS check ────────────────────────────────────────────────────────────────

async function runCheckDns(m: Monitor, ownerEmail: string): Promise<RunCheckResult> {
  const hostname = m.url; // DNS monitors store bare hostname in url column
  const recordType = (m.dnsRecordType ?? "A") as "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
  const expected = (m.dnsExpectedValue ?? "").trim().toLowerCase();

  let ok = false;
  let message: string | undefined;
  const start = Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await (dnsResolve as any)(hostname, recordType);
    const responseTimeMs = Date.now() - start;

    // Normalise records to strings for comparison
    let resolved: string[] = [];
    if (recordType === "MX") {
      resolved = (records as Array<{ exchange: string }>).map((r) =>
        r.exchange.toLowerCase()
      );
    } else if (recordType === "TXT") {
      // TXT: string[][] — each record is an array of chunks; join chunks
      resolved = (records as string[][]).map((chunks) =>
        chunks.join("").toLowerCase()
      );
    } else {
      resolved = (records as string[]).map((r) => r.toLowerCase());
    }

    // TXT uses substring match; all others use exact match
    if (recordType === "TXT") {
      ok = resolved.some((r) => r.includes(expected));
    } else {
      ok = resolved.some((r) => r === expected);
    }

    if (!ok) {
      const found = resolved.join(", ") || "(none)";
      message = `No ${recordType} record matches "${m.dnsExpectedValue}". Found: ${found}`;
    }

    // DNS monitors never run SSL checks
    return applyCheckResult(m, ok, undefined, responseTimeMs, message, Promise.resolve(null), ownerEmail);
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    message = err instanceof Error ? err.message : String(err);
    return applyCheckResult(m, false, undefined, responseTimeMs, message, Promise.resolve(null), ownerEmail);
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run a single uptime check for a monitor. Dispatches to the appropriate
 * check handler based on monitor type (http | keyword | dns).
 */
export async function runCheck(m: Monitor, ownerEmail: string): Promise<RunCheckResult> {
  const monitorType = m.type ?? "http";
  if (monitorType === "dns") return runCheckDns(m, ownerEmail);
  if (monitorType === "keyword") return runCheckKeyword(m, ownerEmail);
  return runCheckHttp(m, ownerEmail);
}
