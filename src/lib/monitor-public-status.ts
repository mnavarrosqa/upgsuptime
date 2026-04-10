import { and, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
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
  type: "http" | "keyword" | "dns";
  intervalMinutes: number;
  paused: boolean | null;
  method: "GET" | "HEAD";
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

export async function getUptimeStats90d(
  monitorIds: string[],
  since: Date
): Promise<Map<string, { total: number; okCount: number }>> {
  const map = new Map<string, { total: number; okCount: number }>();
  if (monitorIds.length === 0) return map;

  const rows = await db
    .select({
      monitorId: checkResult.monitorId,
      total: sql<number>`cast(count(*) as integer)`.mapWith(Number),
      okCount: sql<number>`coalesce(cast(sum(case when ${checkResult.ok} = 1 then 1 else 0 end) as integer), 0)`.mapWith(
        Number
      ),
    })
    .from(checkResult)
    .where(and(inArray(checkResult.monitorId, monitorIds), gte(checkResult.createdAt, since)))
    .groupBy(checkResult.monitorId);

  for (const row of rows) {
    map.set(row.monitorId, { total: row.total, okCount: row.okCount });
  }
  return map;
}
