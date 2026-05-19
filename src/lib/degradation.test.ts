import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEGRADATION_ALERT_COOLDOWN_MINUTES,
  DEGRADATION_CONFIRM_COUNT,
  DEGRADATION_RECENT_WINDOW,
} from "@/lib/degradation-config";

const mocks = vi.hoisted(() => {
  const queryResults: unknown[][] = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(queryResults.shift() ?? [])),
          })),
        })),
      })),
    })),
  };

  return { db, queryResults };
});

vi.mock("@/db", () => ({ db: mocks.db }));

function buildUniformRows(
  recentMs: number,
  baselineMs: number,
  recentCount = DEGRADATION_RECENT_WINDOW,
  baselineCount = 20,
): Array<{ responseTimeMs: number }> {
  return [
    ...Array.from({ length: recentCount }, () => ({ responseTimeMs: recentMs })),
    ...Array.from({ length: baselineCount }, () => ({ responseTimeMs: baselineMs })),
  ];
}

function buildSpikeRows(): Array<{ responseTimeMs: number }> {
  return [
    { responseTimeMs: 3000 },
    ...Array.from({ length: DEGRADATION_RECENT_WINDOW - 1 }, () => ({
      responseTimeMs: 200,
    })),
    ...Array.from({ length: 20 }, () => ({ responseTimeMs: 200 })),
  ];
}

describe("evaluateDegradation", () => {
  beforeEach(() => {
    mocks.queryResults.length = 0;
    mocks.db.select.mockClear();
    vi.resetModules();
  });

  it("does not treat a single spike as degraded", async () => {
    mocks.queryResults.push(buildSpikeRows());
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 6,
      degradingAlertSentAt: null,
    } as never);

    expect(result.recentP75Ms).toBe(200);
    expect(result.consecutiveDegradedChecks).toBe(0);
    expect(result.shouldAlert).toBe(false);
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it("alerts after CONFIRM_COUNT consecutive degraded evaluations", async () => {
    mocks.queryResults.push(buildUniformRows(1000, 200), []);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: DEGRADATION_CONFIRM_COUNT - 1,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(true);
    expect(result.recentP75Ms).toBe(1000);
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
  });

  it("does not alert before CONFIRM_COUNT consecutive degraded evaluations", async () => {
    mocks.queryResults.push(buildUniformRows(1000, 200));
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: DEGRADATION_CONFIRM_COUNT - 2,
      degradingAlertSentAt: null,
    } as never);

    expect(result.consecutiveDegradedChecks).toBe(DEGRADATION_CONFIRM_COUNT - 1);
    expect(result.shouldAlert).toBe(false);
  });

  it("requests episode clear only below CLEAR_RATIO threshold", async () => {
    mocks.queryResults.push(buildUniformRows(300, 200));
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 0,
      degradingAlertSentAt: new Date(),
    } as never);

    expect(result.clearDegradingAlertSentAt).toBe(true);
  });

  it("preserves consecutive count when recent window has too few valid samples", async () => {
    const rows = [
      { responseTimeMs: null as unknown as number },
      ...Array.from({ length: 9 }, () => ({ responseTimeMs: 1000 })),
      ...Array.from({ length: 20 }, () => ({ responseTimeMs: 200 })),
    ];
    mocks.queryResults.push(rows);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 5,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(false);
    expect(result.consecutiveDegradedChecks).toBe(5);
    expect(result.recentP75Ms).toBeNull();
  });

  it("does not let baseline checks leak into recent when latest check has null latency", async () => {
    const rows = [
      ...Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => ({
        responseTimeMs: 200,
      })),
      { responseTimeMs: null as unknown as number },
      ...Array.from({ length: 20 }, () => ({ responseTimeMs: 500 })),
    ];
    mocks.queryResults.push(rows);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 0,
      degradingAlertSentAt: null,
    } as never);

    expect(result.recentP75Ms).toBe(200);
    expect(result.consecutiveDegradedChecks).toBe(0);
    expect(result.baselineSampleCount).toBe(20);
  });

  it("resets consecutive during baseline warmup", async () => {
    mocks.queryResults.push(buildUniformRows(1000, 200, DEGRADATION_RECENT_WINDOW, 10));
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 5,
      degradingAlertSentAt: null,
    } as never);

    expect(result.consecutiveDegradedChecks).toBe(0);
    expect(result.baselineSampleCount).toBe(10);
  });

  it("keeps episode open between CLEAR and ENTER thresholds", async () => {
    mocks.queryResults.push(buildUniformRows(400, 200));
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 0,
      degradingAlertSentAt: new Date(),
    } as never);

    expect(result.clearDegradingAlertSentAt).toBe(false);
    expect(result.consecutiveDegradedChecks).toBe(0);
  });
});

describe("evaluateDegradation cooldown", () => {
  beforeEach(() => {
    mocks.queryResults.length = 0;
    mocks.db.select.mockClear();
    vi.resetModules();
  });

  it("suppresses alert when previous degradation email is inside cooldown window", async () => {
    const withinCooldown = new Date(
      Date.now() - (DEGRADATION_ALERT_COOLDOWN_MINUTES - 5) * 60 * 1000,
    );
    mocks.queryResults.push(buildUniformRows(1000, 200), [{ createdAt: withinCooldown }]);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: DEGRADATION_CONFIRM_COUNT - 1,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(false);
  });

  it("allows alert when previous degradation email is older than cooldown window", async () => {
    const outsideCooldown = new Date(
      Date.now() - (DEGRADATION_ALERT_COOLDOWN_MINUTES + 5) * 60 * 1000,
    );
    mocks.queryResults.push(buildUniformRows(1000, 200), [{ createdAt: outsideCooldown }]);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: DEGRADATION_CONFIRM_COUNT - 1,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(true);
  });
});
