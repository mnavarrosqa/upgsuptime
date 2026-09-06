import { describe, expect, it } from "vitest";
import {
  failedCheckMinutes,
  isSlowerThanUsual,
  lastStatusAt,
  shouldRankUptime,
  soonestSsl,
  sslDaysUntil,
  trendHasSignal,
} from "@/lib/dashboard-overview-stats";

describe("dashboard-overview-stats", () => {
  it("failedCheckMinutes is failed checks times interval", () => {
    expect(failedCheckMinutes(3, 5)).toBe(15);
    expect(failedCheckMinutes(0, 5)).toBe(0);
    expect(failedCheckMinutes(2, 0)).toBe(0);
  });

  it("shouldRankUptime ignores 100% and near-perfect", () => {
    expect(shouldRankUptime(100)).toBe(false);
    expect(shouldRankUptime(99.95)).toBe(false);
    expect(shouldRankUptime(99.8)).toBe(true);
    expect(shouldRankUptime(null)).toBe(false);
  });

  it("isSlowerThanUsual needs baseline and a real gap", () => {
    expect(isSlowerThanUsual(900, 200)).toBe(true);
    expect(isSlowerThanUsual(250, 200)).toBe(false);
    expect(isSlowerThanUsual(900, null)).toBe(false);
    expect(isSlowerThanUsual(200, 200)).toBe(false);
  });

  it("trendHasSignal only when a day failed or latency moved", () => {
    expect(
      trendHasSignal([
        { total: 10, okCount: 10, avgMs: 200 },
        { total: 10, okCount: 10, avgMs: 210 },
      ])
    ).toBe(false);
    expect(
      trendHasSignal([
        { total: 10, okCount: 10, avgMs: 200 },
        { total: 10, okCount: 8, avgMs: 200 },
      ])
    ).toBe(true);
    expect(
      trendHasSignal([
        { total: 10, okCount: 10, avgMs: 200 },
        { total: 10, okCount: 10, avgMs: 320 },
      ])
    ).toBe(true);
  });

  it("sslDaysUntil and soonestSsl pick the nearest expiry", () => {
    const now = Date.parse("2026-08-31T00:00:00.000Z");
    expect(sslDaysUntil("2026-09-10T00:00:00.000Z", now)).toBe(10);
    const soonest = soonestSsl(
      [
        { name: "later", sslMonitoring: true, sslExpiresAt: "2026-12-01T00:00:00.000Z" },
        { name: "soon", sslMonitoring: true, sslExpiresAt: "2026-09-10T00:00:00.000Z" },
        { name: "off", sslMonitoring: false, sslExpiresAt: "2026-09-01T00:00:00.000Z" },
      ],
      now
    );
    expect(soonest).toEqual({ name: "soon", days: 10 });
  });

  it("lastStatusAt returns the first status event", () => {
    expect(
      lastStatusAt([
        { kind: "degradation", at: "2026-08-31T10:00:00.000Z" },
        { kind: "status", at: "2026-08-30T09:00:00.000Z" },
      ])
    ).toBe("2026-08-30T09:00:00.000Z");
    expect(lastStatusAt([{ kind: "degradation", at: "2026-08-31T10:00:00.000Z" }])).toBeNull();
  });
});
