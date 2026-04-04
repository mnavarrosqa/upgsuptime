import { db } from "@/db";
import { checkResult } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import { getTransporter } from "@/lib/notify";
import { buildDegradationAlertHtml } from "@/lib/email-templates";

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Minimum successful checks in the baseline window before it is considered reliable. */
const BASELINE_MIN_SAMPLES = 20;
/**
 * Number of older checks used to compute the baseline P75.
 * Kept separate from the recent window so slow checks during a degradation
 * episode never contaminate the baseline.
 */
const BASELINE_WINDOW = 40;
/** Number of recent checks used to compute the current average. */
const RECENT_WINDOW = 5;
/** Ratio of recent avg to baseline P75 that signals degradation. */
const DEGRADATION_RATIO = 2.0;
/** Consecutive degraded checks required before firing an alert. */
const CONFIRM_COUNT = 3;

// ─── Core logic ───────────────────────────────────────────────────────────────

function computeP75(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.floor(0.75 * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

export type DegradationUpdate = {
  baselineP75Ms: number | null;
  baselineSampleCount: number;
  consecutiveDegradedChecks: number;
  /** When true, caller should set degradingAlertSentAt = null */
  clearDegradingAlertSentAt: boolean;
  /** When true, caller should set degradingAlertSentAt = now and send the email */
  shouldAlert: boolean;
  recentAvgMs: number | null;
};

/**
 * Evaluate whether the current successful check indicates response-time
 * degradation relative to this monitor's learned baseline.
 *
 * Only call for ok === true, type !== "dns", degradationAlertEnabled === true.
 */
export async function evaluateDegradation(
  m: Monitor,
): Promise<DegradationUpdate> {
  // Fetch RECENT_WINDOW + BASELINE_WINDOW successful checks, newest first.
  // The two windows are kept separate so slow checks during a degradation episode
  // never pollute the baseline: recent=[0..RECENT_WINDOW), baseline=[RECENT_WINDOW..end).
  const rows = await db
    .select({ responseTimeMs: checkResult.responseTimeMs })
    .from(checkResult)
    .where(and(eq(checkResult.monitorId, m.id), eq(checkResult.ok, true)))
    .orderBy(desc(checkResult.createdAt))
    .limit(RECENT_WINDOW + BASELINE_WINDOW);

  const times = rows
    .map((r) => r.responseTimeMs)
    .filter((t): t is number => t != null && t > 0);

  // Slice out the two windows (times is newest-first)
  const recentSlice = times.slice(0, Math.min(RECENT_WINDOW, times.length));
  const baselineSlice = times.slice(RECENT_WINDOW);

  const sampleCount = baselineSlice.length;

  // Not enough baseline data yet — update count but skip detection
  if (sampleCount < BASELINE_MIN_SAMPLES || recentSlice.length < RECENT_WINDOW) {
    return {
      baselineP75Ms: null,
      baselineSampleCount: sampleCount,
      consecutiveDegradedChecks: 0,
      clearDegradingAlertSentAt: false,
      shouldAlert: false,
      recentAvgMs: null,
    };
  }

  // Baseline P75 from the older window only
  const sorted = [...baselineSlice].sort((a, b) => a - b);
  const newP75 = computeP75(sorted);

  // Recent average from the newest window
  const recentAvgMs = Math.round(
    recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
  );

  const isDegraded = recentAvgMs >= DEGRADATION_RATIO * newP75;
  const newConsecutive = isDegraded ? (m.consecutiveDegradedChecks ?? 0) + 1 : 0;

  const shouldAlert =
    newConsecutive >= CONFIRM_COUNT && m.degradingAlertSentAt === null;

  const clearDegradingAlertSentAt =
    !isDegraded && m.degradingAlertSentAt !== null;

  return {
    baselineP75Ms: newP75,
    baselineSampleCount: sampleCount,
    consecutiveDegradedChecks: newConsecutive,
    clearDegradingAlertSentAt,
    shouldAlert,
    recentAvgMs,
  };
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendDegradationAlert(
  m: Monitor,
  recentAvgMs: number,
  baselineP75Ms: number,
  ownerEmail: string
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const to = m.alertEmailTo ?? ownerEmail;
  const ratio = (recentAvgMs / baselineP75Ms).toFixed(1);
  const checkedAt = new Date().toUTCString();

  const subject = `[Slow] ${m.name} — response time degrading (${ratio}× above normal)`;
  const text = [
    `Monitor: ${m.name}`,
    `URL: ${m.url}`,
    ``,
    `Recent average response time: ${recentAvgMs} ms`,
    `Normal baseline (P75): ${baselineP75Ms} ms`,
    `Slowdown: ${ratio}× above baseline`,
    ``,
    `Checked at: ${checkedAt}`,
  ].join("\n");

  const html = buildDegradationAlertHtml(m, recentAvgMs, baselineP75Ms, checkedAt);

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
