import { notFound } from "next/navigation";
import { db } from "@/db";
import { monitor, user, checkResult } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { StatusPageShell } from "@/components/status-page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return {
    title: `${username} Status`,
    description: `Service status page for ${username}`,
  };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [u] = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(eq(user.username, username));

  if (!u) notFound();

  const allMonitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, u.id));

  const publicMonitors = allMonitors.filter((m) => m.showOnStatusPage !== false);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const bucketMs = 3 * 24 * 60 * 60 * 1000; // 3 days per bucket

  const monitorsWithStats = await Promise.all(
    publicMonitors.map(async (m) => {
      const rows = await db
        .select({ ok: checkResult.ok, createdAt: checkResult.createdAt })
        .from(checkResult)
        .where(
          and(
            eq(checkResult.monitorId, m.id),
            gte(checkResult.createdAt, ninetyDaysAgo)
          )
        );

      const total = rows.length;
      const okCount = rows.filter((r) => r.ok).length;
      const uptimePct = total > 0 ? Math.round((okCount / total) * 1000) / 10 : null;

      // 30 buckets × 3 days, oldest (index 0) → newest (index 29)
      const buckets: { ok: number; total: number }[] = Array.from(
        { length: 30 },
        () => ({ ok: 0, total: 0 })
      );
      const now = Date.now();
      for (const r of rows) {
        const age = now - new Date(r.createdAt).getTime();
        const rawIdx = Math.floor(age / bucketMs);
        const displayIdx = 29 - Math.min(rawIdx, 29); // 0=oldest, 29=newest
        buckets[displayIdx].total++;
        if (r.ok) buckets[displayIdx].ok++;
      }

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        currentStatus: m.currentStatus,
        lastCheckAt: m.lastCheckAt ? new Date(m.lastCheckAt).toISOString() : null,
        lastStatusChangedAt: m.lastStatusChangedAt
          ? new Date(m.lastStatusChangedAt).toISOString()
          : null,
        uptimePct,
        checkCount90d: total,
        buckets,
      };
    })
  );

  const downCount = monitorsWithStats.filter((m) => m.currentStatus === false).length;
  const incidents = monitorsWithStats.filter((m) => m.currentStatus === false);

  return (
    <StatusPageShell
      username={u.username ?? username}
      monitors={monitorsWithStats}
      downCount={downCount}
      incidents={incidents}
      generatedAt={new Date().toISOString()}
    />
  );
}
