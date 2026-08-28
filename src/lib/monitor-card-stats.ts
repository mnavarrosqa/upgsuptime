export type TrendPoint = {
  id?: string;
  ok: boolean;
  responseTimeMs?: number | null;
  createdAt?: string | Date | null;
  message?: string | null;
};

/** API trend rows are newest-first; charts read left→right (oldest first). */
export function chronologicalTrend(results: TrendPoint[]): TrendPoint[] {
  return [...results].reverse();
}

export function uptimePercent(results: TrendPoint[]): number | null {
  if (results.length === 0) return null;
  return Math.round((results.filter((r) => r.ok).length / results.length) * 100);
}

/**
 * Window change as a signed percent (one decimal) between the older and
 * newer halves of the recent check list. Not latency.
 */
export function trendDeltaPercent(results: TrendPoint[]): number | null {
  if (results.length < 4) return null;
  const chrono = chronologicalTrend(results);
  const mid = Math.floor(chrono.length / 2);
  const older = chrono.slice(0, mid);
  const newer = chrono.slice(mid);

  const pct = (arr: TrendPoint[]) =>
    (arr.filter((r) => r.ok).length / arr.length) * 100;
  const uptimeDelta = pct(newer) - pct(older);
  if (Math.abs(uptimeDelta) < 0.05) return 0;
  return round1(uptimeDelta);
}

/**
 * 0–1 sparkline height from response time. Higher ms sits higher on the
 * chart (same orientation as the detail latency chart). Domain is 0…max
 * ms in the window so a 2s spike is ~10× a 200ms check, not a “health dip”.
 * Down checks with no timing plot at the top.
 */
export function sparklineChartValues(points: TrendPoint[]): number[] {
  const ms = points.map((p) => {
    if (p.responseTimeMs != null && p.responseTimeMs > 0) return p.responseTimeMs;
    return p.ok ? 0 : null;
  });
  const maxMs = Math.max(1, ...ms.filter((v): v is number => v != null));
  const domain = ms.includes(null) ? maxMs / 0.8 : maxMs; // untimed down sits above timed checks
  return ms.map((v) => (v == null ? 1 : v / domain));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sparklineIndexFromViewX(
  viewX: number,
  count: number,
  padX = 0,
  padRight = 0,
  vw = 160,
): number {
  if (count <= 1) return 0;
  const span = vw - padX - padRight;
  const t = span <= 0 ? 0 : (viewX - padX) / span;
  return Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))));
}
