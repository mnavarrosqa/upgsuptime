import { describe, expect, it } from "vitest";
import {
  chronologicalTrend,
  sparklineChartValues,
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

  it("trendDeltaPercent is 0 when uptime is flat", () => {
    const older = [pt(true, 200), pt(true, 200)];
    const newer = [pt(true, 100), pt(true, 100)];
    expect(trendDeltaPercent([...newer, ...older])).toBe(0);
  });

  it("sparklineChartValues put slower checks higher", () => {
    const values = sparklineChartValues([pt(true, 80), pt(true, 400)]);
    expect(values).toEqual([0.2, 1]);
  });

  it("sparklineChartValues put untimed failures at the top", () => {
    const values = sparklineChartValues([pt(true, 80), pt(false, null)]);
    expect(values[1]).toBe(1);
    expect(values[0]).toBe(0.8);
  });

  it("sparklineChartValues scale failed timeouts against real ms", () => {
    const values = sparklineChartValues([pt(true, 100), pt(false, 5000)]);
    expect(values[0]).toBe(0.02);
    expect(values[1]).toBe(1);
  });

  it("sparklineIndexFromViewX maps x to the nearest check", () => {
    expect(sparklineIndexFromViewX(0, 1)).toBe(0);
    expect(sparklineIndexFromViewX(0, 5)).toBe(0);
    expect(sparklineIndexFromViewX(160, 5)).toBe(4);
    expect(sparklineIndexFromViewX(80, 5)).toBe(2);
  });
});
