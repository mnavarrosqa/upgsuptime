import { notFound } from "next/navigation";
import { db } from "@/db";
import { monitor, user, checkResult } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { StatusPageShell } from "@/components/status-page-shell";
import { daysAgoUtc, unixNowMs } from "@/lib/server-relative-time";

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

  const ninetyDaysAgo = daysAgoUtc(90);
  const bucketMs = 3 * 24 * 60 * 60 * 1000; // 3 days per bucket

  const monitorsWithStats = await Promise.all(
    publicMonitors.map(async (m) => {
      const rows = await db
        .select({
          ok: checkResult.ok,
          createdAt: checkResult.createdAt,
          responseTimeMs: checkResult.responseTimeMs,
        })
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

      const responseTimes = rows
        .map((r) => r.responseTimeMs)
        .filter((v): v is number => v !== null);
      const avgResponseTimeMs =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            )
          : null;

      // 30 buckets × 3 days, oldest (index 0) → newest (index 29)
      const buckets: { ok: number; total: number }[] = Array.from(
        { length: 30 },
        () => ({ ok: 0, total: 0 })
      );
      const now = unixNowMs();
      for (const r of rows) {
        const age = now - new Date(r.createdAt).getTime();
        const rawIdx = Math.floor(age / bucketMs);
        const displayIdx = 29 - Math.min(rawIdx, 29); // 0=oldest, 29=newest
        buckets[displayIdx].total++;
        if (r.ok) buckets[displayIdx].ok++;
      }

      // For down monitors, fetch the most recent failed check's error details
      let lastErrorMessage: string | null = null;
      let lastErrorCode: number | null = null;
      if (m.currentStatus === false) {
        const [lastFailed] = await db
          .select({ message: checkResult.message, statusCode: checkResult.statusCode })
          .from(checkResult)
          .where(and(eq(checkResult.monitorId, m.id), eq(checkResult.ok, false)))
          .orderBy(desc(checkResult.createdAt))
          .limit(1);
        lastErrorMessage = lastFailed?.message ?? null;
        lastErrorCode = lastFailed?.statusCode ?? null;
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
        avgResponseTimeMs,
        lastErrorMessage,
        lastErrorCode,
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
