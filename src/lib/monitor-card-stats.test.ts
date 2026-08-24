import { describe, expect, it } from "vitest";
import {
  chronologicalTrend,
  sparklineHealthValues,
  trendDeltaPercent,
  uptimePercent,
  sparklineIndexFromViewX,
  type TrendPoint,
} from "@/lib/monitor-card-stats";

function pt(ok: boolean, ms: number | null = 100): TrendPoint {
  return { ok, responseTimeMs: ms };
}

describe("monitor-card-stats", () => {
  it("uptimePercent rounds the window", () => {
    expect(uptimePercent([])).toBeNull();
    expect(uptimePercent([pt(true), pt(true), pt(false)])).toBe(67);
    expect(uptimePercent([pt(true), pt(true)])).toBe(100);
  });

  it("chronologicalTrend reverses newest-first rows", () => {
    const rows = [pt(true, 1), pt(false, 2)];
    expect(chronologicalTrend(rows).map((r) => r.responseTimeMs)).toEqual([2, 1]);
  });

  it("trendDeltaPercent needs at least four checks", () => {
    expect(trendDeltaPercent([pt(true), pt(true), pt(false)])).toBeNull();
  });

  it("trendDeltaPercent reports uptime drop in the newer half", () => {
    const older = [pt(true), pt(true), pt(true), pt(true)];
    const newer = [pt(true), pt(false), pt(false), pt(false)];
    expect(trendDeltaPercent([...newer].reverse().concat([...older].reverse()))).toBe(-75);
    expect(trendDeltaPercent([...newer, ...older])).toBe(-75);
  });

  it("trendDeltaPercent uses latency when uptime is flat", () => {
    const older = [pt(true, 200), pt(true, 200)];
    const newer = [pt(true, 100), pt(true, 100)];
    expect(trendDeltaPercent([...newer, ...older])).toBe(50);
  });

  it("sparklineHealthValues dip on failed checks", () => {
    const values = sparklineHealthValues([pt(true, 80), pt(false, null)]);
    expect(values[1]).toBeLessThan(values[0]!);
  });

  it("sparklineIndexFromViewX maps x to the nearest check", () => {
    expect(sparklineIndexFromViewX(0, 1)).toBe(0);
    expect(sparklineIndexFromViewX(6, 5)).toBe(0);
    expect(sparklineIndexFromViewX(160 - 12, 5)).toBe(4);
    expect(sparklineIndexFromViewX(6 + (160 - 6 - 12) / 2, 5)).toBe(2);
  });
});
