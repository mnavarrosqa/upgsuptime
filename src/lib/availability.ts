import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { checkResult } from "@/db/schema";

export type Incident = { startMs: number; durationMs: number };

/**
 * Groups failed-check timestamps (ascending) into incidents. Each failed check covers one
 * interval, so an incident lasts from its first failure to its last plus one interval.
 * shortcut: assumes the monitor's current interval for the whole period, revisit if intervals get history.
 */
export function groupIncidents(failedAtMs: number[], intervalMs: number): Incident[] {
  const incidents: Incident[] = [];
  let start = 0;
  let last = 0;
  failedAtMs.forEach((t, i) => {
    if (i > 0 && t - last > intervalMs * 2) {
      incidents.push({ startMs: start, durationMs: last - start + intervalMs });
      start = t;
    } else if (i === 0) {
      start = t;
    }
    last = t;
  });
  if (failedAtMs.length > 0) incidents.push({ startMs: start, durationMs: last - start + intervalMs });
  return incidents;
}

export type AvailabilityRow = {
  period: "today" | "7d" | "30d" | "365d";
  availabilityPct: number | null;
  downtimeMs: number;
  incidents: number;
  longestMs: number;
  avgMs: number;
};

export async function getAvailability(
  monitorId: string,
  intervalMinutes: number,
  nowMs: number,
): Promise<AvailabilityRow[]> {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const periods = [
    { period: "today", since: startOfToday.getTime() },
    { period: "7d", since: nowMs - 7 * day },
    { period: "30d", since: nowMs - 30 * day },
    { period: "365d", since: nowMs - 365 * day },
  ] as const;

  const failed = await db
    .select({ createdAt: checkResult.createdAt })
    .from(checkResult)
    .where(and(eq(checkResult.monitorId, monitorId), eq(checkResult.ok, false), gte(checkResult.createdAt, new Date(periods[3].since))))
    .orderBy(checkResult.createdAt);
  const failedMs = failed.map((r) => r.createdAt.getTime());

  return Promise.all(
    periods.map(async ({ period, since }) => {
      const [counts] = await db
        .select({
          total: sql<number>`count(*)`,
          ok: sql<number>`coalesce(sum(case when ${checkResult.ok} then 1 else 0 end), 0)`,
        })
        .from(checkResult)
        .where(and(eq(checkResult.monitorId, monitorId), gte(checkResult.createdAt, new Date(since))));
      const incidents = groupIncidents(
        failedMs.filter((t) => t >= since),
        intervalMinutes * 60_000,
      );
      const downtimeMs = incidents.reduce((a, i) => a + i.durationMs, 0);
      return {
        period,
        availabilityPct: counts.total > 0 ? (counts.ok / counts.total) * 100 : null,
        downtimeMs,
        incidents: incidents.length,
        longestMs: Math.max(0, ...incidents.map((i) => i.durationMs)),
        avgMs: incidents.length > 0 ? Math.round(downtimeMs / incidents.length) : 0,
      };
    }),
  );
}
