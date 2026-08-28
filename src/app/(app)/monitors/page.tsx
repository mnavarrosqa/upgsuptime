import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult, user } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { DashboardContent } from "@/components/dashboard-content";
import { getCheckLocationLabel } from "@/lib/check-location";
import {
  getUptimeStats90d,
  ninetyDaysAgoFrom,
  uptimePctFromCounts,
} from "@/lib/monitor-public-status";

export default async function MonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [monitors, [userOnboarding]] = await Promise.all([
    db.select().from(monitor).where(eq(monitor.userId, session.user.id)),
    db
      .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep })
      .from(user)
      .where(eq(user.id, session.user.id)),
  ]);

  const latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }> = {};
  let trendByMonitor: Record<
    string,
    { id: string; ok: boolean; responseTimeMs: number | null; createdAt: string; message: string | null }[]
  > = {};
  const uptimeByMonitor: Record<string, number | null> = {};
  const checkLocation = getCheckLocationLabel();

  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    const trendLimit = Math.min(monitorIds.length * 24, 500);

    const [recentResults, uptimeStats] = await Promise.all([
      db
        .select({
          id: checkResult.id,
          monitorId: checkResult.monitorId,
          ok: checkResult.ok,
          responseTimeMs: checkResult.responseTimeMs,
          message: checkResult.message,
          createdAt: checkResult.createdAt,
        })
        .from(checkResult)
        .where(inArray(checkResult.monitorId, monitorIds))
        .orderBy(desc(checkResult.createdAt))
        .limit(trendLimit),
      getUptimeStats90d(monitorIds, ninetyDaysAgoFrom()),
    ]);

    const grouped = new Map<
      string,
      { id: string; ok: boolean; responseTimeMs: number | null; createdAt: string; message: string | null }[]
    >();
    for (const r of recentResults) {
      if (!(r.monitorId in latestByMonitor)) {
        latestByMonitor[r.monitorId] = { ok: r.ok, responseTimeMs: r.responseTimeMs, message: r.message };
      }
      const list = grouped.get(r.monitorId) ?? [];
      if (list.length < 24) {
        list.push({
          id: r.id,
          ok: r.ok,
          responseTimeMs: r.responseTimeMs,
          createdAt: new Date(r.createdAt).toISOString(),
          message: r.message,
        });
        grouped.set(r.monitorId, list);
      }
    }
    trendByMonitor = Object.fromEntries(grouped);
    for (const m of monitors) {
      const counts = uptimeStats.get(m.id);
      uptimeByMonitor[m.id] = counts
        ? uptimePctFromCounts(counts.total, counts.okCount)
        : null;
    }
  }

  return (
    <DashboardContent
      monitors={monitors}
      latestByMonitor={latestByMonitor}
      trendByMonitor={trendByMonitor}
      uptimeByMonitor={uptimeByMonitor}
      username={session.user.name ?? null}
      onboarding={{
        onboardingCompleted: userOnboarding?.onboardingCompleted,
        onboardingStep: userOnboarding?.onboardingStep,
      }}
      userId={session.user.id}
      checkLocation={checkLocation}
    />
  );
}
