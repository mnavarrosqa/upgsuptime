import { randomUUID } from "crypto";
import { lookup as dnsLookup, resolve as dnsResolve } from "dns/promises";
import { connect as netConnect } from "net";
import { fetch as undiciFetch, buildConnector, Agent } from "undici";
import { db } from "@/db";
import { monitor, checkResult, degradationAlertEvent } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import { getUrlNotAllowedReason, isBlockedIP } from "@/lib/url-allowed";
import { sendNotifications, sendSslNotifications } from "@/lib/notify";
import type { SslAlertType } from "@/lib/notify";
import { evaluateDegradation, sendDegradationAlert } from "@/lib/degradation";
import { checkSSL } from "@/lib/check-ssl";
import { isMaintenanceActive, parseStoredRequestHeaders } from "@/lib/monitor-config";
import type { MonitorOwner } from "@/lib/monitor-owner";

export type PhaseTimings = {
  dnsMs?: number;
  connectMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
};

export type RunCheckResult = {
  monitorId: string;
  ok: boolean;
  statusCode?: number;
  responseTimeMs: number;
  timings?: PhaseTimings;
  attempts?: number;
  message?: string;
};

export type RunCheckOptions = {
  maintenanceActive?: boolean;
  manual?: boolean;
};

/** Number of consecutive failures required before transitioning to DOWN and alerting. */
const CONFIRMATION_COUNT = 2;

/**
 * Undici connector that re-validates resolved IPs at connect time (SSRF guard)
 * and captures per-request DNS/connect timing via a shared PhaseTimings object.
 */
const defaultConnector = buildConnector({});

function createInstrumentedAgent(timings: PhaseTimings): Agent {
  return new Agent({
    connect: (options, callback) => {
      const hostname = (options as { hostname?: string }).hostname ?? "";
      const dnsStart = performance.now();
      dnsLookup(hostname, { all: true })
        .then((addresses) => {
          timings.dnsMs = Math.round(performance.now() - dnsStart);
          for (const { address } of addresses) {
            if (isBlockedIP(address)) {
              callback(new Error(`Resolved IP ${address} is not allowed (SSRF protection)`), null);
              return;
            }
          }
          const connectStart = performance.now();
          defaultConnector(options, (err, socket) => {
            if (!err && socket) {
              const connectEnd = performance.now();
              timings.connectMs = Math.round(connectEnd - connectStart);
              const tlsSocket = socket as import("tls").TLSSocket;
              if (typeof tlsSocket.encrypted !== "undefined") {
                timings.tlsMs = Math.round(connectEnd - connectStart);
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (callback as any)(err, socket);
          });
        })
        .catch((err: unknown) => {
          timings.dnsMs = Math.round(performance.now() - dnsStart);
          callback(err instanceof Error ? err : new Error(String(err)), null);
        });
    },
  });
}

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
  owner: MonitorOwner,
  opts: RunCheckOptions = {},
  timings?: PhaseTimings,
  attempts?: number
): Promise<RunCheckResult> {
  const now = new Date();
  const maintenanceActive = opts.maintenanceActive ?? isMaintenanceActive(m, now);
  const effectiveMessage =
    message ??
    (maintenanceActive && opts.manual
      ? "Manual check during maintenance window"
      : maintenanceActive
        ? m.maintenanceNote || "Maintenance window active"
        : undefined);

  const id = randomUUID();
  await db.insert(checkResult).values({
    id,
    monitorId: m.id,
    statusCode: statusCode ?? null,
    responseTimeMs,
    dnsMs: timings?.dnsMs ?? null,
    connectMs: timings?.connectMs ?? null,
    tlsMs: timings?.tlsMs ?? null,
    ttfbMs: timings?.ttfbMs ?? null,
    attempts: attempts ?? null,
    ok,
    message: effectiveMessage ?? null,
    duringMaintenance: maintenanceActive || null,
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

  // Await SSL result (likely already done by now); DNS monitors always pass null
  const sslResult = await sslPromise;

  // Expiry-only SSL emails: one reminder when crossing into ≤7 days, another at ≤2 days
  let sslAlertType: SslAlertType | null = null;
  if (sslResult?.valid && sslResult.daysUntilExpiry !== null) {
    const oldDays = daysUntil(m.sslExpiresAt);
    const newDays = sslResult.daysUntilExpiry;
    if (newDays <= 2 && (oldDays === null || oldDays > 2)) {
      sslAlertType = "critical";
    } else if (newDays <= 7 && (oldDays === null || oldDays > 7)) {
      sslAlertType = "expiring";
    }
  }

  // Degradation detection — only for successful HTTP/keyword checks with the feature enabled
  let degradationFields: Record<string, unknown> = {};
  let shouldSendDegradationAlert = false;
  let degradationAlertArgs: { recentP75Ms: number; baselineP75Ms: number } | null = null;

  if (ok && (m.type === "http" || m.type === "keyword") && m.degradationAlertEnabled) {
    const deg = await evaluateDegradation(m);
    degradationFields = {
      baselineP75Ms: deg.baselineP75Ms,
      baselineSampleCount: deg.baselineSampleCount,
      consecutiveDegradedChecks: deg.consecutiveDegradedChecks,
      ...(deg.clearDegradingAlertSentAt ? { degradingAlertSentAt: null } : {}),
      ...(deg.shouldAlert ? { degradingAlertSentAt: now } : {}),
    };
    if (deg.shouldAlert && deg.recentP75Ms !== null && deg.baselineP75Ms !== null) {
      shouldSendDegradationAlert = true;
      degradationAlertArgs = { recentP75Ms: deg.recentP75Ms, baselineP75Ms: deg.baselineP75Ms };
    }
  } else if (!ok && m.degradationAlertEnabled) {
    // Failed checks are excluded from latency windows; reset confirmation only so a
    // prior slow-response episode is not extended by downtime.
    degradationFields = { consecutiveDegradedChecks: 0 };
  }

  // Single DB update: HTTP fields + SSL fields + consecutiveFailures + degradation in one round-trip
  await db
    .update(monitor)
    .set({
      lastCheckAt: now,
      consecutiveFailures: newConsecutiveFailures,
      ...(shouldTransition && ok ? { downtimeAckEpisodeAt: null } : {}),
      ...(shouldTransition ? { currentStatus: ok, lastStatusChangedAt: now } : {}),
      ...(sslResult
        ? {
            sslValid: sslResult.valid,
            sslExpiresAt: sslResult.expiresAt,
            sslLastCheckedAt: now,
          }
        : {}),
      ...degradationFields,
    })
    .where(sql`${monitor.id} = ${m.id}`);

  if (shouldSendDegradationAlert && degradationAlertArgs) {
    await db.insert(degradationAlertEvent).values({
      id: randomUUID(),
      monitorId: m.id,
      createdAt: now,
      recentAvgMs: degradationAlertArgs.recentP75Ms,
      baselineP75Ms: degradationAlertArgs.baselineP75Ms,
    });
  }

  const result: RunCheckResult = {
    monitorId: m.id,
    ok,
    statusCode,
    responseTimeMs,
    timings,
    attempts,
    message: effectiveMessage,
  };

  // Fire-and-forget: notification errors must not propagate
  if (shouldNotify && !maintenanceActive) {
    sendNotifications(m, ok, result, owner.email, owner.language, {
      downEpisodeAt: !ok ? now : undefined,
    }).catch((err) => {
      console.error("[run-check] notification error for monitor", m.id, err);
    });
  }
  // Only send standalone SSL alerts when the site is up — if it's down, SSL
  // failure is expected and would just add noise to the inbox.
  if (ok && sslResult && sslAlertType && !maintenanceActive) {
    sendSslNotifications(m, sslResult, sslAlertType, owner.email, owner.language).catch((err) => {
      console.error("[run-check] SSL notification error for monitor", m.id, err);
    });
  }

  if (shouldSendDegradationAlert && degradationAlertArgs && m.alertEmail && !maintenanceActive) {
    sendDegradationAlert(m, degradationAlertArgs.recentP75Ms, degradationAlertArgs.baselineP75Ms, owner.email, owner.language).catch((err) => {
      console.error("[run-check] degradation alert error for monitor", m.id, err);
    });
  }

  return result;
}

// ─── HTTP check ───────────────────────────────────────────────────────────────

function buildHttpRequestOptions(m: Monitor): {
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  body?: string;
  redirect: "follow" | "manual";
  maxRedirections: number;
} {
  const method = (["GET", "HEAD", "POST", "PUT", "PATCH"].includes(m.method)
    ? m.method
    : "GET") as "GET" | "HEAD" | "POST" | "PUT" | "PATCH";
  const headers: Record<string, string> = { "User-Agent": "UPGMonitor/1.0" };
  for (const header of parseStoredRequestHeaders(m.requestHeaders)) {
    headers[header.name] = header.value;
  }

  const body = m.requestBody ?? undefined;
  if (body && method !== "GET" && method !== "HEAD") {
    const hasContentType = Object.keys(headers).some(
      (name) => name.toLowerCase() === "content-type"
    );
    if (!hasContentType && m.requestBodyType === "json") {
      headers["Content-Type"] = "application/json";
    } else if (!hasContentType && m.requestBodyType === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  return {
    method,
    headers,
    body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
    redirect: m.followRedirects === false ? "manual" : "follow",
    maxRedirections: Math.min(20, Math.max(0, m.maxRedirects ?? 20)),
  };
}

async function runCheckHttp(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const timeoutMs = Math.min(120, Math.max(5, m.timeoutSeconds ?? 15)) * 1000;
  const requestOptions = buildHttpRequestOptions(m);
  const isSuccess = parseExpectedStatusCodes(m.expectedStatusCodes ?? "200-299");

  let ok = false;
  let statusCode: number | undefined;
  let message: string | undefined;
  let responseTimeMs = 0;
  let timings: PhaseTimings = {};
  let finalAttempt = 1;

  const notAllowedReason = await getUrlNotAllowedReason(m.url);
  if (notAllowedReason) {
    message = notAllowedReason;
  } else {
    for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      finalAttempt = attempt;

      const attemptStart = performance.now();
      ok = false;
      statusCode = undefined;
      message = undefined;
      timings = {};
      const agent = createInstrumentedAgent(timings);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const fetchOptions = {
          method: requestOptions.method,
          signal: controller.signal,
          headers: requestOptions.headers,
          body: requestOptions.body,
          redirect: requestOptions.redirect,
          maxRedirections: requestOptions.maxRedirections,
          dispatcher: agent,
        } as unknown as Parameters<typeof undiciFetch>[1];
        const res = await undiciFetch(m.url, fetchOptions);
        timings.ttfbMs = Math.round(performance.now() - attemptStart);
        statusCode = res.status;
        ok = isSuccess(res.status);
        await res.body?.cancel();
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
        await agent.close();
      }

      responseTimeMs = Math.round(performance.now() - attemptStart);
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

  return applyCheckResult(m, ok, statusCode, responseTimeMs, message, sslPromise, owner, opts, timings, finalAttempt);
}

// ─── Keyword check ────────────────────────────────────────────────────────────

async function runCheckKeyword(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const timeoutMs = Math.min(120, Math.max(5, m.timeoutSeconds ?? 15)) * 1000;
  const isSuccess = parseExpectedStatusCodes(m.expectedStatusCodes ?? "200-299");
  const keyword = (m.keywordContains ?? "").toLowerCase();
  const shouldExist = m.keywordShouldExist !== false; // default true

  let ok = false;
  let statusCode: number | undefined;
  let message: string | undefined;
  let responseTimeMs = 0;
  let timings: PhaseTimings = {};
  let finalAttempt = 1;

  const notAllowedReason = await getUrlNotAllowedReason(m.url);
  if (notAllowedReason) {
    message = notAllowedReason;
  } else {
    for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      finalAttempt = attempt;

      const attemptStart = performance.now();
      ok = false;
      statusCode = undefined;
      message = undefined;
      timings = {};
      const agent = createInstrumentedAgent(timings);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await undiciFetch(m.url, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "UPGMonitor/1.0" },
          dispatcher: agent,
        });
        timings.ttfbMs = Math.round(performance.now() - attemptStart);
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
        await agent.close();
      }

      responseTimeMs = Math.round(performance.now() - attemptStart);
      if (ok) break;
    }
  }

  // SSL check in parallel (keyword monitors can be HTTPS)
  const sslPromise =
    m.sslMonitoring && !notAllowedReason
      ? checkSSL(m.url, 10_000)
      : Promise.resolve(null);

  return applyCheckResult(m, ok, statusCode, responseTimeMs, message, sslPromise, owner, opts, timings, finalAttempt);
}

// ─── DNS check ────────────────────────────────────────────────────────────────

async function runCheckDns(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const hostname = m.url; // DNS monitors store bare hostname in url column
  const recordType = (m.dnsRecordType ?? "A") as "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
  const expected = (m.dnsExpectedValue ?? "").trim().toLowerCase();

  let ok = false;
  let message: string | undefined;
  const start = performance.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await (dnsResolve as any)(hostname, recordType);
    const responseTimeMs = Math.round(performance.now() - start);

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
    return applyCheckResult(m, ok, undefined, responseTimeMs, message, Promise.resolve(null), owner, opts, { dnsMs: responseTimeMs });
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - start);
    message = err instanceof Error ? err.message : String(err);
    return applyCheckResult(m, false, undefined, responseTimeMs, message, Promise.resolve(null), owner, opts, { dnsMs: responseTimeMs });
  }
}

// ─── TCP check ────────────────────────────────────────────────────────────────

async function runCheckTcp(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const host = (m.tcpHost ?? m.url).trim();
  const port = m.tcpPort ?? 0;
  const timeoutMs = Math.min(120, Math.max(5, m.timeoutSeconds ?? 15)) * 1000;
  const start = performance.now();
  let ok = false;
  let message: string | undefined;
  const timings: PhaseTimings = {};

  try {
    const dnsStart = performance.now();
    const addresses = await dnsLookup(host, { all: true });
    timings.dnsMs = Math.round(performance.now() - dnsStart);
    if (!addresses.length) {
      message = "Could not resolve TCP host";
    } else if (addresses.some(({ address }) => isBlockedIP(address))) {
      message = "TCP host resolves to a disallowed address";
    } else {
      const connectStart = performance.now();
      await new Promise<void>((resolve, reject) => {
        const socket = netConnect({ host: addresses[0].address, port });
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error("TCP connection timed out"));
        }, timeoutMs);

        socket.once("connect", () => {
          clearTimeout(timeout);
          timings.connectMs = Math.round(performance.now() - connectStart);
          ok = true;
          socket.end();
          resolve();
        });
        socket.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }

  return applyCheckResult(
    m,
    ok,
    undefined,
    Math.round(performance.now() - start),
    message,
    Promise.resolve(null),
    owner,
    opts,
    timings
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run a single uptime check for a monitor. Dispatches to the appropriate
 * check handler based on monitor type (http | keyword | dns | tcp).
 */
export async function runCheck(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const monitorType = m.type ?? "http";
  if (monitorType === "dns") return runCheckDns(m, owner, opts);
  if (monitorType === "keyword") return runCheckKeyword(m, owner, opts);
  if (monitorType === "tcp") return runCheckTcp(m, owner, opts);
  return runCheckHttp(m, owner, opts);
}
