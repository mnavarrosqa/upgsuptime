import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MonitorsPageClient } from "@/components/monitors-page-client";

export default async function MonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const latestByMonitor: Record<string, { ok: boolean }> = {};

  for (const m of monitors) {
    if (m.currentStatus !== null) {
      latestByMonitor[m.id] = { ok: m.currentStatus };
    }
  }

  return (
    <MonitorsPageClient
      monitors={monitors}
      latestByMonitor={latestByMonitor}
    />
  );
}
