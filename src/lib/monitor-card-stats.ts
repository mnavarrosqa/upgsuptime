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
 * Window change as a signed percent (one decimal).
 * Prefers uptime shift between the older/newer halves; if uptime is flat,
 * falls back to latency improvement (faster = positive).
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
  if (Math.abs(uptimeDelta) >= 0.05) {
    return round1(uptimeDelta);
  }

  const olderAvg = avgMs(older);
  const newerAvg = avgMs(newer);
  if (olderAvg == null || newerAvg == null || olderAvg === 0) return 0;
  return round1(((olderAvg - newerAvg) / olderAvg) * 100);
}

export function sparklineHealthValues(points: TrendPoint[]): number[] {
  return points.map((p) => {
    if (!p.ok) return 0.12;
    if (p.responseTimeMs == null) return 0.72;
    const ms = Math.max(p.responseTimeMs, 1);
    return 0.22 + 0.78 / (1 + ms / 400);
  });
}

export function normalizeSparklineValues(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 0.04) return values.map(() => 0.62);
  return values.map((v) => 0.12 + ((v - min) / (max - min)) * 0.76);
}

function avgMs(arr: TrendPoint[]): number | null {
  const times = arr
    .map((r) => r.responseTimeMs)
    .filter((ms): ms is number => ms != null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sparklineIndexFromViewX(
  viewX: number,
  count: number,
  padX = 6,
  padRight = 12,
  vw = 160,
): number {
  if (count <= 1) return 0;
  const span = vw - padX - padRight;
  const t = span <= 0 ? 0 : (viewX - padX) / span;
  return Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))));
}
