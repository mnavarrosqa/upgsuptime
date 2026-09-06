import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FleetTrendPoint, RankingPoint } from "@/components/dashboard-charts";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getCheckLocationLabel } from "@/lib/check-location";
import { loadActivityFeed } from "@/lib/activity-feed";
import { isDowntimeAcked } from "@/lib/downtime-ack";
import { isMaintenanceActive } from "@/lib/monitor-config";
import { getTranslations } from "next-intl/server";
import {
  fillFleetDayTrend,
  getFleetDailyStats,
  getRecentChecksByMonitor,
  getUptimeStats90d,
  ninetyDaysAgoFrom,
  uptimePctFromCounts,
  utcDaysBack,
} from "@/lib/monitor-public-status";
import {
  SSL_WARN_DAYS,
  failedCheckMinutes,
  isSlowerThanUsual,
  lastStatusAt,
  shouldRankUptime,
  soonestSsl,
  sslDaysUntil,
} from "@/lib/dashboard-overview-stats";

const RANK_LIMIT = 5;
const ATTENTION_LIMIT = 8;

function isLatestOk(
  monitorId: string,
  currentStatus: boolean | null,
  latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }>
): boolean | null {
  const latest = latestByMonitor[monitorId];
  if (latest) return latest.ok;
  if (currentStatus == null) return null;
  return currentStatus;
}

function isCheckOverdue(
  lastCheckAt: Date | null | undefined,
  intervalMinutes: number,
  nowMs: number
): boolean {
  if (!lastCheckAt) return false;
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
  return nowMs > lastCheckAt.getTime() + intervalMs * 2;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // eslint-disable-next-line react-hooks/purity -- RSC request time
  const nowMs = Date.now();

  const [monitors, [userOnboarding], activityAll] = await Promise.all([
    db.select().from(monitor).where(eq(monitor.userId, session.user.id)),
    db
      .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep })
      .from(user)
      .where(eq(user.id, session.user.id)),
    loadActivityFeed(session.user.id),
  ]);

  const latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }> = {};
  const uptimeByMonitor: Record<string, number | null> = {};
  const downtimeMinByMonitor: Record<string, number> = {};
  let downtimeMin90d = 0;
  let trendByDay: FleetTrendPoint[] = [];

  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    const dayKeys = utcDaysBack(nowMs, 7);
    const trendSince = new Date(`${dayKeys[0]}T00:00:00.000Z`);
    const [recentResults, uptimeStats, dailyRows] = await Promise.all([
      getRecentChecksByMonitor(monitorIds, 1),
      getUptimeStats90d(monitorIds, ninetyDaysAgoFrom(nowMs)),
      getFleetDailyStats(monitorIds, trendSince),
    ]);

    for (const r of recentResults) {
      if (!(r.monitorId in latestByMonitor)) {
        latestByMonitor[r.monitorId] = {
          ok: r.ok,
          responseTimeMs: r.responseTimeMs,
          message: r.message,
        };
      }
    }
    for (const m of monitors) {
      const counts = uptimeStats.get(m.id);
      uptimeByMonitor[m.id] = counts
        ? uptimePctFromCounts(counts.total, counts.okCount)
        : null;
      const failed = counts ? counts.total - counts.okCount : 0;
      const minutes = failedCheckMinutes(failed, m.intervalMinutes);
      downtimeMinByMonitor[m.id] = minutes;
      downtimeMin90d += minutes;
    }
    trendByDay = fillFleetDayTrend(dailyRows, dayKeys).map((d) => ({
      day: d.day,
      total: d.total,
      okCount: d.okCount,
      uptimePct: uptimePctFromCounts(d.total, d.okCount),
      avgMs: d.avgMs,
    }));
  }

  const pausedCount = monitors.filter((m) => m.paused).length;
  const downCount = monitors.filter((m) => {
    if (m.paused) return false;
    return isLatestOk(m.id, m.currentStatus, latestByMonitor) === false;
  }).length;
  const maintenanceCount = monitors.filter((m) =>
    isMaintenanceActive(m, new Date(nowMs))
  ).length;
  const allPaused = monitors.length > 0 && pausedCount === monitors.length;

  const attention = monitors
    .flatMap((m) => {
      if (m.paused) return [];
      const ok = isLatestOk(m.id, m.currentStatus, latestByMonitor);
      const down = ok === false;
      const latest = latestByMonitor[m.id];
      const overdue = isCheckOverdue(m.lastCheckAt, m.intervalMinutes, nowMs);
      const pending = m.lastCheckAt == null;
      const degraded =
        ok === true &&
        ((m.consecutiveDegradedChecks ?? 0) > 0 || m.degradingAlertSentAt != null);
      const kind = down
        ? ("down" as const)
        : overdue
          ? ("overdue" as const)
          : pending
            ? ("pending" as const)
            : degraded
              ? ("degraded" as const)
              : null;
      if (!kind) return [];
      return [
        {
          id: m.id,
          name: m.name,
          url: m.url,
          type: m.type,
          kind,
          acked: down && isDowntimeAcked(m),
          since:
            kind === "down" && m.lastStatusChangedAt
              ? new Date(m.lastStatusChangedAt).toISOString()
              : kind === "overdue" && m.lastCheckAt
                ? new Date(m.lastCheckAt).toISOString()
                : null,
          detail: down ? (latest?.message ?? null) : null,
          consecutiveFailures: down ? (m.consecutiveFailures ?? null) : null,
          latestMs: kind === "degraded" ? (latest?.responseTimeMs ?? null) : null,
          baselineMs: kind === "degraded" ? (m.baselineP75Ms ?? null) : null,
        },
      ];
    })
    .sort((a, b) => {
      const rank = (r: { kind: string; acked: boolean }) => {
        if (r.kind === "down" && !r.acked) return 0;
        if (r.kind === "overdue") return 1;
        if (r.kind === "pending") return 2;
        if (r.kind === "degraded") return 3;
        return 4;
      };
      return rank(a) - rank(b);
    })
    .slice(0, ATTENTION_LIMIT);

  const attentionIds = new Set(attention.map((row) => row.id));

  const worstUptime: RankingPoint[] = monitors
    .filter((m) => shouldRankUptime(uptimeByMonitor[m.id]) && (downtimeMinByMonitor[m.id] ?? 0) > 0)
    .sort((a, b) => (downtimeMinByMonitor[b.id] ?? 0) - (downtimeMinByMonitor[a.id] ?? 0))
    .slice(0, RANK_LIMIT)
    .map((m) => ({
      id: m.id,
      name: m.name,
      n: downtimeMinByMonitor[m.id] ?? 0,
      href: `/monitors/${m.id}`,
      url: m.url,
      type: m.type,
    }));

  const tOverview = await getTranslations("overview");

  const slowest = monitors
    .filter((m) => {
      if (m.paused || attentionIds.has(m.id)) return false;
      const latest = latestByMonitor[m.id];
      return latest?.ok === true && isSlowerThanUsual(latest.responseTimeMs, m.baselineP75Ms);
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
      value: tOverview("slowDetail", {
        recent: latestByMonitor[m.id]!.responseTimeMs!,
        baseline: m.baselineP75Ms!,
      }),
      href: `/monitors/${m.id}`,
      url: m.url,
      type: m.type,
    }));

  const ssl = monitors
    .flatMap((m) => {
      if (m.sslMonitoring !== true) return [];
      const days = sslDaysUntil(m.sslExpiresAt, nowMs);
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
          url: m.url,
          type: m.type,
        },
      ];
    })
    .sort((a, b) => {
      if (a.invalid !== b.invalid) return a.invalid ? -1 : 1;
      return a.days - b.days;
    })
    .slice(0, RANK_LIMIT)
    .map(({ id, name, value, href, url, type }) => ({ id, name, value, href, url, type }));

  const nextSsl = soonestSsl(monitors, nowMs);
  const nextSslHealthy =
    nextSsl && nextSsl.days > SSL_WARN_DAYS
      ? { name: nextSsl.name, days: nextSsl.days }
      : null;

  return (
    <DashboardOverview
      hasMonitors={monitors.length > 0}
      downCount={downCount}
      pausedCount={pausedCount}
      maintenanceCount={maintenanceCount}
      totalCount={monitors.length}
      downtimeMin90d={downtimeMin90d}
      lastIncidentAt={lastStatusAt(activityAll)}
      nextSsl={nextSslHealthy}
      allPaused={allPaused}
      checkLocation={getCheckLocationLabel()}
      username={session.user.name ?? null}
      attention={attention}
      activity={activityAll}
      trendByDay={trendByDay}
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
