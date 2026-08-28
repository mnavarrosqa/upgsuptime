import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult, user } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import type { ActivityDayPoint, FleetSlice, RankingPoint } from "@/components/dashboard-charts";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getCheckLocationLabel } from "@/lib/check-location";
import { loadActivityFeed } from "@/lib/activity-feed";
import type { ActivityItem } from "@/lib/activity-item";
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

function activityByUtcDay(items: ActivityItem[]): ActivityDayPoint[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  const days: ActivityDayPoint[] = [];
  const index = new Map<string, ActivityDayPoint>();
  for (let i = 6; i >= 0; i--) {
    const key = new Date(Date.UTC(y, mo, d - i)).toISOString().slice(0, 10);
    const point: ActivityDayPoint = { day: key, down: 0, recovered: 0, degraded: 0 };
    days.push(point);
    index.set(key, point);
  }
  for (const item of items) {
    const bucket = index.get(item.at.slice(0, 10));
    if (!bucket) continue;
    if (item.kind === "degradation") bucket.degraded += 1;
    else if (item.recovered) bucket.recovered += 1;
    else bucket.down += 1;
  }
  return days;
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
  let fleetUptimePct: number | null = null;

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
    let fleetTotal = 0;
    let fleetOk = 0;
    for (const m of monitors) {
      const counts = uptimeStats.get(m.id);
      uptimeByMonitor[m.id] = counts
        ? uptimePctFromCounts(counts.total, counts.okCount)
        : null;
      if (counts) {
        fleetTotal += counts.total;
        fleetOk += counts.okCount;
      }
    }
    fleetUptimePct = uptimePctFromCounts(fleetTotal, fleetOk);
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
  const unknownCount = monitors.filter((m) => {
    if (m.paused) return false;
    return isLatestOk(m.id, m.currentStatus, latestByMonitor) === null;
  }).length;
  const allPaused = monitors.length > 0 && pausedCount === monitors.length;
  const fleet: FleetSlice[] = [
    { key: "up", value: upCount },
    { key: "down", value: downCount },
    { key: "paused", value: pausedCount },
    { key: "unknown", value: unknownCount },
  ];

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

  const hasUptimeData = monitors.some((m) => uptimeByMonitor[m.id] != null);
  const worstUptime: RankingPoint[] = monitors
    .filter((m) => {
      const pct = uptimeByMonitor[m.id];
      return pct != null && pct < 100;
    })
    .sort((a, b) => (uptimeByMonitor[a.id] ?? 100) - (uptimeByMonitor[b.id] ?? 100))
    .slice(0, RANK_LIMIT)
    .map((m) => {
      const pct = uptimeByMonitor[m.id]!;
      return {
        id: m.id,
        name: m.name,
        n: Math.round(pct * 10) / 10,
        href: `/monitors/${m.id}`,
      };
    });

  const slowest: RankingPoint[] = monitors
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
      n: latestByMonitor[m.id]!.responseTimeMs!,
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
      pausedCount={pausedCount}
      totalCount={monitors.length}
      fleetUptimePct={fleetUptimePct}
      hasUptimeData={hasUptimeData}
      allPaused={allPaused}
      checkLocation={getCheckLocationLabel()}
      username={session.user.name ?? null}
      attention={attention}
      activity={activityAll.slice(0, ACTIVITY_SNIPPET)}
      fleet={fleet}
      activityByDay={activityByUtcDay(activityAll)}
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
