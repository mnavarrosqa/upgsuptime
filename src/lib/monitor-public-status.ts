import { and, gte, inArray, isNull, or, eq, sql } from "drizzle-orm";
import { checkResult, monitor } from "@/db/schema";

export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function ninetyDaysAgoFrom(nowMs: number = Date.now()): Date {
  return new Date(nowMs - NINETY_DAYS_MS);
}

export function uptimePctFromCounts(total: number, okCount: number): number | null {
  if (total <= 0) return null;
  return Math.round((okCount / total) * 1000) / 10;
}

export type MonitorPublicStatusItem = {
  id: string;
  name: string;
  url: string;
  type: "http" | "keyword" | "dns" | "tcp";
  intervalMinutes: number;
  paused: boolean | null;
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH";
  maintenanceActive: boolean;
  maintenanceNote: string | null;
  sslMonitoring: boolean | null;
  sslValid: boolean | null;
  sslExpiresAt: string | null;
  consecutiveFailures: number | null;
  currentStatus: boolean | null;
  lastCheckAt: string | null;
  lastStatusChangedAt: string | null;
  uptimePct: number | null;
  checkCount90d: number;
};

type MonitorRow = typeof monitor.$inferSelect;

export function buildMonitorPublicStatusItem(
  m: MonitorRow,
  counts: { total: number; okCount: number } | undefined
): MonitorPublicStatusItem {
  const total = counts?.total ?? 0;
  const okCount = counts?.okCount ?? 0;
  return {
    id: m.id,
    name: m.name,
    url: m.url,
    type: m.type,
    intervalMinutes: m.intervalMinutes,
    paused: m.paused ?? null,
    method: m.method,
    maintenanceActive:
      !!m.maintenanceStartsAt &&
      !!m.maintenanceEndsAt &&
      m.maintenanceStartsAt.getTime() <= Date.now() &&
      m.maintenanceEndsAt.getTime() > Date.now(),
    maintenanceNote: m.maintenanceNote ?? null,
    sslMonitoring: m.sslMonitoring ?? null,
    sslValid: m.sslValid ?? null,
    sslExpiresAt: m.sslExpiresAt ? new Date(m.sslExpiresAt).toISOString() : null,
    consecutiveFailures: m.consecutiveFailures ?? null,
    currentStatus: m.currentStatus ?? null,
    lastCheckAt: m.lastCheckAt ? new Date(m.lastCheckAt).toISOString() : null,
    lastStatusChangedAt: m.lastStatusChangedAt
      ? new Date(m.lastStatusChangedAt).toISOString()
      : null,
    uptimePct: uptimePctFromCounts(total, okCount),
    checkCount90d: total,
  };
}

export function utcDaysBack(nowMs: number, count: number): string[] {
  const now = new Date(nowMs);
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    days.push(new Date(Date.UTC(y, mo, d - i)).toISOString().slice(0, 10));
  }
  return days;
}

export type FleetDailyStat = {
  day: string;
  total: number;
  okCount: number;
  avgMs: number | null;
};

export function fillFleetDayTrend(rows: FleetDailyStat[], days: string[]): FleetDailyStat[] {
  const index = new Map(rows.map((r) => [r.day, r]));
  return days.map((day) => {
    const r = index.get(day);
    if (!r) return { day, total: 0, okCount: 0, avgMs: null };
    const avgMs = r.avgMs == null || Number.isNaN(r.avgMs) ? null : Math.round(r.avgMs);
    return { day, total: r.total, okCount: r.okCount, avgMs };
  });
}

function notDuringMaintenance() {
  return or(isNull(checkResult.duringMaintenance), eq(checkResult.duringMaintenance, false));
}

export async function getUptimeStats90d(
  monitorIds: string[],
  since: Date
): Promise<Map<string, { total: number; okCount: number }>> {
  const map = new Map<string, { total: number; okCount: number }>();
  if (monitorIds.length === 0) return map;

  const { db } = await import("@/db");
  const notMaintenance = notDuringMaintenance();
  const rows = await db
    .select({
      monitorId: checkResult.monitorId,
      total: sql<number>`cast(count(*) as integer)`.mapWith(Number),
      okCount: sql<number>`coalesce(cast(sum(case when ${checkResult.ok} = 1 then 1 else 0 end) as integer), 0)`.mapWith(
        Number
      ),
    })
    .from(checkResult)
    .where(and(inArray(checkResult.monitorId, monitorIds), gte(checkResult.createdAt, since), notMaintenance))
    .groupBy(checkResult.monitorId);

  for (const row of rows) {
    map.set(row.monitorId, { total: row.total, okCount: row.okCount });
  }
  return map;
}

export async function getFleetDailyStats(
  monitorIds: string[],
  since: Date
): Promise<FleetDailyStat[]> {
  if (monitorIds.length === 0) return [];

  const { db } = await import("@/db");
  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${checkResult.createdAt}, 'unixepoch')`;
  const rows = await db
    .select({
      day: dayExpr,
      total: sql<number>`cast(count(*) as integer)`.mapWith(Number),
      okCount: sql<number>`coalesce(cast(sum(case when ${checkResult.ok} = 1 then 1 else 0 end) as integer), 0)`.mapWith(
        Number
      ),
      avgMs: sql<number | null>`avg(case when ${checkResult.ok} = 1 and ${checkResult.responseTimeMs} is not null then ${checkResult.responseTimeMs} end)`.mapWith(
        (v) => {
          if (v == null || v === "") return null;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        }
      ),
    })
    .from(checkResult)
    .where(
      and(
        inArray(checkResult.monitorId, monitorIds),
        gte(checkResult.createdAt, since),
        notDuringMaintenance()
      )
    )
    .groupBy(dayExpr);

  return rows.flatMap((row) => {
    const day = row.day?.slice(0, 10);
    if (!day) return [];
    return [{ day, total: row.total, okCount: row.okCount, avgMs: row.avgMs }];
  });
}
