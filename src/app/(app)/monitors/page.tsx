import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { MonitorsPageClient } from "@/components/monitors-page-client";

export default async function MonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const latestByMonitor: Record<string, { ok: boolean }> = {};

  if (monitors.length > 0) {
    const monitorIds = monitors.map((m) => m.id);
    // Fetch all latest results in parallel using a single query grouped by monitor,
    // then pick the most-recent per monitor — eliminates the N+1 sequential waterfall.
    const recentResults = await db
      .select({ monitorId: checkResult.monitorId, ok: checkResult.ok, createdAt: checkResult.createdAt })
      .from(checkResult)
      .where(inArray(checkResult.monitorId, monitorIds))
      .orderBy(desc(checkResult.createdAt));

    // Keep only the first (most recent) result per monitor
    for (const r of recentResults) {
      if (!(r.monitorId in latestByMonitor)) {
        latestByMonitor[r.monitorId] = { ok: r.ok };
      }
    }
  }

  return (
    <MonitorsPageClient
      monitors={monitors}
      latestByMonitor={latestByMonitor}
    />
  );
}
