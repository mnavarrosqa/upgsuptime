export const UPTIME_RANK_BELOW_PCT = 99.9;
export const SLOW_VS_BASELINE_RATIO = 1.5;
export const SLOW_MIN_MS = 300;
export const TREND_MS_SPREAD_MIN = 80;
export const SSL_WARN_DAYS = 30;

type TrendDay = { total: number; okCount: number; avgMs: number | null };

/** ponytail: failed checks × interval, not wall-clock incident length */
export function failedCheckMinutes(failedCount: number, intervalMinutes: number): number {
  if (failedCount <= 0 || intervalMinutes <= 0) return 0;
  return failedCount * intervalMinutes;
}

export function shouldRankUptime(pct: number | null): boolean {
  return pct != null && pct < UPTIME_RANK_BELOW_PCT;
}

export function isSlowerThanUsual(
  latestMs: number | null | undefined,
  baselineMs: number | null | undefined,
  ratio = SLOW_VS_BASELINE_RATIO,
  minMs = SLOW_MIN_MS
): boolean {
  if (latestMs == null || baselineMs == null || baselineMs <= 0) return false;
  return latestMs >= minMs && latestMs >= baselineMs * ratio;
}

export function trendHasSignal(trend: TrendDay[]): boolean {
  const days = trend.filter((d) => d.total > 0);
  if (days.length < 2) return false;
  if (days.some((d) => d.okCount < d.total)) return true;
  const ms = days.flatMap((d) => (d.avgMs == null ? [] : [d.avgMs]));
  if (ms.length < 2) return false;
  return Math.max(...ms) - Math.min(...ms) >= TREND_MS_SPREAD_MIN;
}

export function sslDaysUntil(
  expiresAt: Date | string | null | undefined,
  nowMs: number
): number | null {
  if (expiresAt == null) return null;
  return Math.ceil((new Date(expiresAt).getTime() - nowMs) / (1000 * 60 * 60 * 24));
}

export function soonestSsl(
  items: { name: string; sslMonitoring: boolean | null; sslExpiresAt: Date | string | null }[],
  nowMs: number
): { name: string; days: number } | null {
  let best: { name: string; days: number } | null = null;
  for (const item of items) {
    if (item.sslMonitoring !== true) continue;
    const days = sslDaysUntil(item.sslExpiresAt, nowMs);
    if (days == null) continue;
    if (!best || days < best.days) best = { name: item.name, days };
  }
  return best;
}

export function lastStatusAt(
  items: { kind: string; at: string }[]
): string | null {
  const hit = items.find((item) => item.kind === "status");
  return hit?.at ?? null;
}
