import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and, gte, isNotNull, desc } from "drizzle-orm";
import { ActivityPageClient } from "@/components/activity-page-client";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const items = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      currentStatus: monitor.currentStatus,
      lastStatusChangedAt: monitor.lastStatusChangedAt,
    })
    .from(monitor)
    .where(
      and(
        eq(monitor.userId, session.user.id),
        isNotNull(monitor.lastStatusChangedAt),
        gte(monitor.lastStatusChangedAt, since)
      )
    )
    .orderBy(desc(monitor.lastStatusChangedAt));

  return <ActivityPageClient items={items} />;
}
