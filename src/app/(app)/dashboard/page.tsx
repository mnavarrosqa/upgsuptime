import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult, user } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getCheckLocationLabel } from "@/lib/check-location";
import { loadActivityFeed } from "@/lib/activity-feed";
import { isDowntimeAcked } from "@/lib/downtime-ack";
import { getTranslations } from "next-intl/server";
import {
  getUptimeStats90d,
  ninetyDaysAgoFrom,
  uptimePctFromCounts,
} from "@/lib/monitor-public-status";

const ACTIVITY_SNIPPET = 5;
const RANK_LIMIT = 5;
const ATTENTION_LIMIT = 8;
const SSL_WARN_DAYS = 30;

function sslDaysUntil(expiresAt: Date | string | null | undefined): number | null {
  if (expiresAt == null) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isLatestOk(
  monitorId: string,
  currentStatus: boolean | null,
  latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null }>
): boolean | null {
  const latest = latestByMonitor[monitorId];
  if (latest) return latest.ok;
  if (currentStatus == null) return null;
  return currentStatus;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [monitors, [userOnboarding], activityAll] = await Promise.all([
    db.select().from(monitor).where(eq(monitor.userId, session.user.id)),
    db
      .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep })
      .from(user)
      .where(eq(user.id, session.user.id)),
    loadActivityFeed(session.user.id),
  ]);

  const latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null }> = {};
  const uptimeByMonitor: Record<string, number | null> = {};

  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    const latestLimit = Math.min(monitorIds.length * 24, 500);

    const [recentResults, uptimeStats] = await Promise.all([
      db
        .select({
          monitorId: checkResult.monitorId,
          ok: checkResult.ok,
          responseTimeMs: checkResult.responseTimeMs,
        })
        .from(checkResult)
        .where(inArray(checkResult.monitorId, monitorIds))
        .orderBy(desc(checkResult.createdAt))
        .limit(latestLimit),
      getUptimeStats90d(monitorIds, ninetyDaysAgoFrom()),
    ]);

    for (const r of recentResults) {
      if (!(r.monitorId in latestByMonitor)) {
        latestByMonitor[r.monitorId] = { ok: r.ok, responseTimeMs: r.responseTimeMs };
      }
    }
    for (const m of monitors) {
      const counts = uptimeStats.get(m.id);
      uptimeByMonitor[m.id] = counts
        ? uptimePctFromCounts(counts.total, counts.okCount)
        : null;
    }
  }

  const pausedCount = monitors.filter((m) => m.paused).length;
  const downCount = monitors.filter((m) => {
    if (m.paused) return false;
    return isLatestOk(m.id, m.currentStatus, latestByMonitor) === false;
  }).length;
  const upCount = monitors.filter((m) => {
    if (m.paused) return false;
    return isLatestOk(m.id, m.currentStatus, latestByMonitor) === true;
  }).length;
  const allPaused = monitors.length > 0 && pausedCount === monitors.length;

  const attention = monitors
    .flatMap((m) => {
      if (m.paused) return [];
      const ok = isLatestOk(m.id, m.currentStatus, latestByMonitor);
      const down = ok === false;
      const degraded =
        ok === true &&
        ((m.consecutiveDegradedChecks ?? 0) > 0 || m.degradingAlertSentAt != null);
      if (!down && !degraded) return [];
      return [
        {
          id: m.id,
          name: m.name,
          acked: down && isDowntimeAcked(m),
          degraded: !down && degraded,
        },
      ];
    })
    .slice(0, ATTENTION_LIMIT);

  const worstUptime = monitors
    .filter((m) => uptimeByMonitor[m.id] != null)
    .sort((a, b) => (uptimeByMonitor[a.id] ?? 100) - (uptimeByMonitor[b.id] ?? 100))
    .slice(0, RANK_LIMIT)
    .map((m) => ({
      id: m.id,
      name: m.name,
      value: `${uptimeByMonitor[m.id]!.toFixed(uptimeByMonitor[m.id]! % 1 === 0 ? 0 : 1)}%`,
      href: `/monitors/${m.id}`,
    }));

  const slowest = monitors
    .filter((m) => {
      const latest = latestByMonitor[m.id];
      return !m.paused && latest?.ok && latest.responseTimeMs != null;
    })
    .sort(
      (a, b) =>
        (latestByMonitor[b.id]?.responseTimeMs ?? 0) -
        (latestByMonitor[a.id]?.responseTimeMs ?? 0)
    )
    .slice(0, RANK_LIMIT)
    .map((m) => ({
      id: m.id,
      name: m.name,
      value: `${latestByMonitor[m.id]!.responseTimeMs} ms`,
      href: `/monitors/${m.id}`,
    }));

  const tOverview = await getTranslations("overview");

  const ssl = monitors
    .flatMap((m) => {
      if (m.sslMonitoring !== true) return [];
      const days = sslDaysUntil(m.sslExpiresAt);
      const invalid = m.sslValid === false;
      const expiring = days != null && days <= SSL_WARN_DAYS;
      if (!invalid && !expiring) return [];
      const value = invalid
        ? tOverview("sslInvalid")
        : days != null && days < 0
          ? tOverview("sslExpired")
          : tOverview("sslDays", { n: days ?? 0 });
      return [
        {
          id: m.id,
          name: m.name,
          value,
          days: days ?? (invalid ? -999 : 999),
          invalid,
          href: `/monitors/${m.id}`,
        },
      ];
    })
    .sort((a, b) => {
      if (a.invalid !== b.invalid) return a.invalid ? -1 : 1;
      return a.days - b.days;
    })
    .slice(0, RANK_LIMIT)
    .map(({ id, name, value, href }) => ({ id, name, value, href }));

  return (
    <DashboardOverview
      hasMonitors={monitors.length > 0}
      downCount={downCount}
      upCount={upCount}
      pausedCount={pausedCount}
      totalCount={monitors.length}
      allPaused={allPaused}
      checkLocation={getCheckLocationLabel()}
      username={session.user.name ?? null}
      attention={attention}
      activity={activityAll.slice(0, ACTIVITY_SNIPPET)}
      worstUptime={worstUptime}
      slowest={slowest}
      ssl={ssl}
      onboarding={{
        onboardingCompleted: userOnboarding?.onboardingCompleted,
        onboardingStep: userOnboarding?.onboardingStep,
      }}
      userId={session.user.id}
    />
  );
}
