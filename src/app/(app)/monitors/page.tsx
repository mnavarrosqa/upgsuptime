import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { MonitorsPageClient } from "@/components/monitors-page-client";

export default async function MonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const latestByMonitor: Record<string, boolean> = {};
  for (const m of monitors) {
    const [latest] = await db
      .select({ ok: checkResult.ok })
      .from(checkResult)
      .where(eq(checkResult.monitorId, m.id))
      .orderBy(desc(checkResult.createdAt))
      .limit(1);
    if (latest) latestByMonitor[m.id] = latest.ok;
  }

  return (
    <MonitorsPageClient
      monitors={monitors}
      latestByMonitor={latestByMonitor}
    />
  );
}
