import { describe, expect, it } from "vitest";
import type { Monitor } from "@/db/schema";
import {
  buildMonitorPublicStatusItem,
  NINETY_DAYS_MS,
  ninetyDaysAgoFrom,
  uptimePctFromCounts,
} from "@/lib/monitor-public-status";

function baseMonitor(over: Partial<Monitor> = {}): Monitor {
  const createdAt = new Date("2024-01-01T00:00:00.000Z");
  return {
    id: "m1",
    userId: "u1",
    name: "Test",
    url: "https://example.com",
    intervalMinutes: 5,
    timeoutSeconds: 15,
    method: "GET",
    expectedStatusCodes: "200-299",
    lastCheckAt: null,
    currentStatus: true,
    lastStatusChangedAt: null,
    downtimeAckEpisodeAt: null,
    alertEmail: false,
    alertEmailTo: null,
    sslMonitoring: false,
    sslValid: null,
    sslExpiresAt: null,
    sslLastCheckedAt: null,
    showOnStatusPage: true,
    paused: false,
    consecutiveFailures: 0,
    type: "http",
    keywordContains: null,
    keywordShouldExist: true,
    dnsRecordType: null,
    dnsExpectedValue: null,
    createdAt,
    degradationAlertEnabled: null,
    baselineP75Ms: null,
    baselineSampleCount: null,
    consecutiveDegradedChecks: null,
    degradingAlertSentAt: null,
    baselineResetAt: null,
    ...over,
  };
}

describe("monitor-public-status", () => {
  it("computes ninetyDaysAgoFrom relative to a fixed now", () => {
    const now = 1_700_000_000_000;
    const ago = ninetyDaysAgoFrom(now);
    expect(ago.getTime()).toBe(now - NINETY_DAYS_MS);
  });

  it("uptimePctFromCounts returns null when no checks", () => {
    expect(uptimePctFromCounts(0, 0)).toBeNull();
    expect(uptimePctFromCounts(0, 5)).toBeNull();
  });

  it("uptimePctFromCounts rounds to one decimal like the API", () => {
    expect(uptimePctFromCounts(10, 8)).toBe(80);
    expect(uptimePctFromCounts(3, 3)).toBe(100);
    expect(uptimePctFromCounts(3, 1)).toBe(33.3);
  });

  it("buildMonitorPublicStatusItem uses defaults when no stats row", () => {
    const item = buildMonitorPublicStatusItem(baseMonitor(), undefined);
    expect(item.checkCount90d).toBe(0);
    expect(item.uptimePct).toBeNull();
    expect(item.type).toBe("http");
    expect(item.intervalMinutes).toBe(5);
    expect(item.paused).toBe(false);
    expect(item.sslMonitoring).toBe(false);
    expect(item.consecutiveFailures).toBe(0);
  });

  it("buildMonitorPublicStatusItem maps stats and SSL timestamps", () => {
    const sslExpires = new Date("2026-06-01T12:00:00.000Z");
    const item = buildMonitorPublicStatusItem(
      baseMonitor({
        type: "dns",
        paused: null,
        sslMonitoring: true,
        sslValid: true,
        sslExpiresAt: sslExpires,
        consecutiveFailures: null,
      }),
      { total: 100, okCount: 99 }
    );
    expect(item.uptimePct).toBe(99);
    expect(item.checkCount90d).toBe(100);
    expect(item.type).toBe("dns");
    expect(item.paused).toBeNull();
    expect(item.sslExpiresAt).toBe(sslExpires.toISOString());
    expect(item.consecutiveFailures).toBeNull();
  });
});
