import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEGRADATION_ALERT_COOLDOWN_MINUTES } from "@/lib/degradation-config";

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

describe("evaluateDegradation cooldown", () => {
  beforeEach(() => {
    mocks.queryResults.length = 0;
    mocks.db.select.mockClear();
  });

  function buildRows(recentMs: number, baselineMs: number): Array<{ responseTimeMs: number }> {
    return [
      ...Array.from({ length: 7 }, () => ({ responseTimeMs: recentMs })),
      ...Array.from({ length: 20 }, () => ({ responseTimeMs: baselineMs })),
    ];
  }

  it("alerts when degraded and no recent degradation alert event exists", async () => {
    mocks.queryResults.push(buildRows(1000, 200), []);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 4,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(true);
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
  });

  it("suppresses alert when previous degradation email is inside cooldown window", async () => {
    const withinCooldown = new Date(Date.now() - (DEGRADATION_ALERT_COOLDOWN_MINUTES - 5) * 60 * 1000);
    mocks.queryResults.push(buildRows(1000, 200), [{ createdAt: withinCooldown }]);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 4,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(false);
  });

  it("allows alert when previous degradation email is older than cooldown window", async () => {
    const outsideCooldown = new Date(Date.now() - (DEGRADATION_ALERT_COOLDOWN_MINUTES + 5) * 60 * 1000);
    mocks.queryResults.push(buildRows(1000, 200), [{ createdAt: outsideCooldown }]);
    const { evaluateDegradation } = await import("@/lib/degradation");

    const result = await evaluateDegradation({
      id: "monitor-1",
      consecutiveDegradedChecks: 4,
      degradingAlertSentAt: null,
    } as never);

    expect(result.shouldAlert).toBe(true);
  });
});
