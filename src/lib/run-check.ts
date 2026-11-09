import { randomUUID } from "crypto";
import { db } from "@/db";
import { monitor, checkResult, degradationAlertEvent } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import { sendNotifications, sendSslNotifications } from "@/lib/notify";
import { sendMonitorStatusPush } from "@/lib/push";
import type { SslAlertType } from "@/lib/notify";
import { evaluateDegradation, sendDegradationAlert } from "@/lib/degradation";
import { isMaintenanceActive } from "@/lib/monitor-config";
import type { MonitorOwner } from "@/lib/monitor-owner";
import { probeMonitor, type PhaseTimings, type ProbeResult } from "@/lib/probe";

export { createInstrumentedConnect, type PhaseTimings } from "@/lib/probe";

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

/** Days until a stored expiry date, or null */
function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Shared state machine ─────────────────────────────────────────────────────

/**
 * Records a probe result: stores it, runs the confirmation state machine, updates
 * the monitor row and fires notifications on status transitions.
 */
export async function ingestProbeResult(
  m: Monitor,
  probe: ProbeResult,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  const { ok, statusCode, responseTimeMs, message, timings, attempts } = probe;
  const now = probe.checkedAt;
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

  // Null for DNS and TCP monitors and when SSL monitoring is off
  const sslResult = probe.ssl;

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
    // Push goes to every app device the owner registered, independent of the email toggle.
    sendMonitorStatusPush(m, ok, result, owner.language).catch((err) => {
      console.error("[run-check] push error for monitor", m.id, err);
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

// ─── Public entry point ───────────────────────────────────────────────────────

/** Run a single uptime check for a monitor: probe it, then record the result. */
export async function runCheck(
  m: Monitor,
  owner: MonitorOwner,
  opts: RunCheckOptions = {}
): Promise<RunCheckResult> {
  return ingestProbeResult(m, await probeMonitor(m), owner, opts);
}
