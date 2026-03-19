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

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const [userOnboarding] = await db
    .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep })
    .from(user)
    .where(eq(user.id, session.user.id));

  const latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }> = {};
  for (const m of monitors) {
    const [latest] = await db
      .select({ ok: checkResult.ok, responseTimeMs: checkResult.responseTimeMs, message: checkResult.message })
      .from(checkResult)
      .where(eq(checkResult.monitorId, m.id))
      .orderBy(desc(checkResult.createdAt))
      .limit(1);
    if (latest) latestByMonitor[m.id] = { ok: latest.ok, responseTimeMs: latest.responseTimeMs, message: latest.message };
  }

  let trendByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null }[]> = {};
  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    const limit = Math.min(monitorIds.length * 24, 500);
    const recentResults = await db
      .select({ monitorId: checkResult.monitorId, ok: checkResult.ok, responseTimeMs: checkResult.responseTimeMs })
      .from(checkResult)
      .where(inArray(checkResult.monitorId, monitorIds))
      .orderBy(desc(checkResult.createdAt))
      .limit(limit);
    const grouped = new Map<string, { ok: boolean; responseTimeMs: number | null }[]>();
    for (const r of recentResults) {
      const list = grouped.get(r.monitorId) ?? [];
      if (list.length < 24) {
        list.push({ ok: r.ok, responseTimeMs: r.responseTimeMs });
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
