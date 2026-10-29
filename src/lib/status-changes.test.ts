import { describe, expect, it } from "vitest";
import { diffStatuses, type MonitorStatusSnapshot } from "./status-changes";

function snap(overrides: Partial<MonitorStatusSnapshot> = {}): MonitorStatusSnapshot {
  return { id: "m1", name: "Shop", status: "up", changedAt: "2026-01-01T00:00:00.000Z", acknowledged: false, ...overrides };
}

const before = (...items: MonitorStatusSnapshot[]) => new Map(items.map((m) => [m.id, m]));

describe("diffStatuses", () => {
  it("reports outages and recoveries", () => {
    expect(diffStatuses(before(snap()), [snap({ status: "down", changedAt: "b" })])).toEqual([
      { kind: "down", id: "m1", name: "Shop" },
    ]);
    expect(diffStatuses(before(snap({ status: "down" })), [snap({ status: "up", changedAt: "c" })])).toEqual([
      { kind: "recovered", id: "m1", name: "Shop" },
    ]);
  });

  it("alerts when a pending monitor is confirmed down", () => {
    expect(diffStatuses(before(snap({ status: "pending", changedAt: null })), [snap({ status: "down" })])).toHaveLength(1);
  });

  it("stays quiet without a change, for new monitors, pauses and first successes", () => {
    expect(diffStatuses(before(snap()), [snap()])).toEqual([]);
    expect(diffStatuses(before(snap({ status: "down" })), [snap({ status: "down" })])).toEqual([]);
    expect(diffStatuses(before(), [snap({ status: "down" })])).toEqual([]);
    expect(diffStatuses(before(snap({ status: "down" })), [snap({ status: "paused" })])).toEqual([]);
    expect(diffStatuses(before(snap({ status: "pending" })), [snap({ status: "up" })])).toEqual([]);
  });

  it("alerts again for a new down episode between polls", () => {
    expect(
      diffStatuses(before(snap({ status: "down", changedAt: "a" })), [snap({ status: "down", changedAt: "b" })]),
    ).toHaveLength(1);
  });

  it("skips acknowledged outages", () => {
    expect(diffStatuses(before(snap()), [snap({ status: "down", acknowledged: true })])).toEqual([]);
  });
});
