import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult, user } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Start both independent queries in parallel — monitors list and user onboarding
  // data have no dependency on each other.
  const [monitors, [userOnboarding]] = await Promise.all([
    db.select().from(monitor).where(eq(monitor.userId, session.user.id)),
    db
      .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep })
      .from(user)
      .where(eq(user.id, session.user.id)),
  ]);

  const latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }> = {};
  let trendByMonitor: Record<string, { id: string; ok: boolean; responseTimeMs: number | null }[]> = {};

  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    const trendLimit = Math.min(monitorIds.length * 24, 500);

    // Fetch latest status and trend data in a single batched query instead of
    // N sequential per-monitor queries — eliminates the N+1 waterfall.
    const recentResults = await db
      .select({
        id: checkResult.id,
        monitorId: checkResult.monitorId,
        ok: checkResult.ok,
        responseTimeMs: checkResult.responseTimeMs,
        message: checkResult.message,
      })
      .from(checkResult)
      .where(inArray(checkResult.monitorId, monitorIds))
      .orderBy(desc(checkResult.createdAt))
      .limit(trendLimit);

    const grouped = new Map<string, { id: string; ok: boolean; responseTimeMs: number | null }[]>();
    for (const r of recentResults) {
      // First result per monitor = most recent = latestByMonitor entry
      if (!(r.monitorId in latestByMonitor)) {
        latestByMonitor[r.monitorId] = { ok: r.ok, responseTimeMs: r.responseTimeMs, message: r.message };
      }
      const list = grouped.get(r.monitorId) ?? [];
      if (list.length < 24) {
        list.push({ id: r.id, ok: r.ok, responseTimeMs: r.responseTimeMs });
        grouped.set(r.monitorId, list);
      }
    }
    trendByMonitor = Object.fromEntries(grouped);
  }

  return (
    <DashboardContent
      monitors={monitors}
      latestByMonitor={latestByMonitor}
      trendByMonitor={trendByMonitor}
      username={session.user.name ?? null}
      onboarding={{
        onboardingCompleted: userOnboarding?.onboardingCompleted,
        onboardingStep: userOnboarding?.onboardingStep,
      }}
      userId={session.user.id}
    />
  );
}
