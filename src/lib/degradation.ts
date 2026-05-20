import { db } from "@/db";
import { checkResult, degradationAlertEvent } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { Monitor } from "@/db/schema";
import {
  DEGRADATION_ALERT_COOLDOWN_MINUTES as ALERT_COOLDOWN_MINUTES,
  DEGRADATION_BASELINE_WINDOW as BASELINE_WINDOW,
  DEGRADATION_CONFIRM_COUNT as CONFIRM_COUNT,
  DEGRADATION_RECENT_WINDOW as RECENT_WINDOW,
} from "@/lib/degradation-config";
import {
  computeDegradationSnapshot,
  DEGRADATION_FETCH_BUFFER,
  isDegradationWarmup,
  splitDegradationWindowsFromRows,
} from "@/lib/degradation-snapshot";
import type { AppLocale } from "@/i18n/config";
import { emailFormat, getEmailMessages } from "@/lib/email-i18n";
import { getAppBaseUrlForEmail, getTransporter } from "@/lib/notify";
import { buildDegradationAlertHtml } from "@/lib/email-templates";

export type DegradationUpdate = {
  baselineP75Ms: number | null;
  baselineSampleCount: number;
  consecutiveDegradedChecks: number;
  /** When true, caller should set degradingAlertSentAt = null */
  clearDegradingAlertSentAt: boolean;
  /** When true, caller should set degradingAlertSentAt = now and send the email */
  shouldAlert: boolean;
  /** Recent-window P75 (stored in recent_avg_ms column for compatibility). */
  recentP75Ms: number | null;
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
    .limit(RECENT_WINDOW + BASELINE_WINDOW + DEGRADATION_FETCH_BUFFER);

  const { recentTimes, baselineTimes } = splitDegradationWindowsFromRows(rows);
  const sampleCount = baselineTimes.length;

  const snapshot = computeDegradationSnapshot(recentTimes, baselineTimes);
  if (!snapshot) {
    const insufficientRecent = recentTimes.length < RECENT_WINDOW;
    const inWarmup = isDegradationWarmup(sampleCount);
    // Keep confirmation progress when baseline is ready but recent window is short
    // (e.g. null response times on the latest checks). Warmup always resets.
    const preserveConsecutive = insufficientRecent && !inWarmup;

    return {
      baselineP75Ms: null,
      baselineSampleCount: sampleCount,
      consecutiveDegradedChecks: preserveConsecutive
        ? (m.consecutiveDegradedChecks ?? 0)
        : 0,
      clearDegradingAlertSentAt: false,
      shouldAlert: false,
      recentP75Ms: null,
    };
  }

  const { baselineP75Ms: newP75, recentP75Ms, isDegraded, shouldClearEpisode } =
    snapshot;
  const newConsecutive = isDegraded ? (m.consecutiveDegradedChecks ?? 0) + 1 : 0;

  let shouldAlert = newConsecutive >= CONFIRM_COUNT && m.degradingAlertSentAt === null;
  if (shouldAlert && ALERT_COOLDOWN_MINUTES > 0) {
    const latestEvent = await db
      .select({ createdAt: degradationAlertEvent.createdAt })
      .from(degradationAlertEvent)
      .where(eq(degradationAlertEvent.monitorId, m.id))
      .orderBy(desc(degradationAlertEvent.createdAt))
      .limit(1);
    const latestCreatedAt = latestEvent[0]?.createdAt;
    if (latestCreatedAt) {
      const elapsedMs = Date.now() - latestCreatedAt.getTime();
      shouldAlert = elapsedMs >= ALERT_COOLDOWN_MINUTES * 60 * 1000;
    }
  }

  const clearDegradingAlertSentAt =
    shouldClearEpisode && m.degradingAlertSentAt !== null;

  return {
    baselineP75Ms: newP75,
    baselineSampleCount: sampleCount,
    consecutiveDegradedChecks: newConsecutive,
    clearDegradingAlertSentAt,
    shouldAlert,
    recentP75Ms,
  };
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendDegradationAlert(
  m: Monitor,
  recentP75Ms: number,
  baselineP75Ms: number,
  ownerEmail: string,
  locale: AppLocale,
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const messages = await getEmailMessages(locale);
  const to = m.alertEmailTo ?? ownerEmail;
  const ratio =
    baselineP75Ms > 0 ? (recentP75Ms / baselineP75Ms).toFixed(1) : "—";
  const checkedAt = new Date().toUTCString();

  const subject = emailFormat(messages.degradation.subject, {
    name: m.name,
    ratio,
  });
  const baseUrl = getAppBaseUrlForEmail();
  const monitorDetailUrl = baseUrl
    ? `${baseUrl}/monitors/${encodeURIComponent(m.id)}`
    : null;

  const text = [
    `${messages.monitor}: ${m.name}`,
    `${messages.url}: ${m.url}`,
    monitorDetailUrl
      ? emailFormat(messages.viewMonitorText, { url: monitorDetailUrl })
      : null,
    ``,
    emailFormat(messages.degradation.textRecentP75, { ms: recentP75Ms }),
    emailFormat(messages.degradation.textBaselineP75, { ms: baselineP75Ms }),
    emailFormat(messages.degradation.textSlowdown, { ratio }),
    ``,
    emailFormat(messages.checkedAt, { at: checkedAt }),
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = buildDegradationAlertHtml(
    m,
    recentP75Ms,
    baselineP75Ms,
    checkedAt,
    messages,
    locale,
    monitorDetailUrl,
  );

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
