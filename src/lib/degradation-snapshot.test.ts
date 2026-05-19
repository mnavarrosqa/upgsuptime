import { describe, expect, it } from "vitest";
import {
  computeDegradationSnapshot,
  computeDegradationSnapshotFromHistory,
  computeP75,
  splitDegradationWindows,
  splitDegradationWindowsFromRows,
} from "@/lib/degradation-snapshot";
import {
  DEGRADATION_BASELINE_WINDOW,
  DEGRADATION_RECENT_WINDOW,
} from "@/lib/degradation-config";

describe("computeP75", () => {
  it("returns 75th percentile for sorted samples", () => {
    const sorted = [100, 100, 100, 100, 100, 100, 100, 100, 100, 3000];
    expect(computeP75(sorted)).toBe(100);
  });
});

describe("computeDegradationSnapshot", () => {
  it("ignores a single spike in the recent window (P75 stays near baseline)", () => {
    const recent = [3000, ...Array.from({ length: DEGRADATION_RECENT_WINDOW - 1 }, () => 200)];
    const baseline = Array.from({ length: 20 }, () => 200);
    const snapshot = computeDegradationSnapshot(recent, baseline);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.isDegraded).toBe(false);
  });

  it("detects sustained slowdown when recent P75 stays elevated", () => {
    const recent = Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => 1000);
    const baseline = Array.from({ length: 20 }, () => 200);
    const snapshot = computeDegradationSnapshot(recent, baseline);
    expect(snapshot!.isDegraded).toBe(true);
    expect(snapshot!.recentP75Ms).toBe(1000);
  });

  it("uses MIN_RECENT_MS floor for very fast baselines", () => {
    const recent = Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => 500);
    const baseline = Array.from({ length: 20 }, () => 80);
    const snapshot = computeDegradationSnapshot(recent, baseline);
    expect(snapshot!.enterThresholdMs).toBe(450);
    expect(snapshot!.isDegraded).toBe(true);
  });

  it("clears episode only below CLEAR_RATIO × baseline", () => {
    const baseline = Array.from({ length: 20 }, () => 200);
    const elevated = computeDegradationSnapshot(
      Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => 400),
      baseline,
    );
    expect(elevated!.shouldClearEpisode).toBe(false);

    const recovered = computeDegradationSnapshot(
      Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => 300),
      baseline,
    );
    expect(recovered!.shouldClearEpisode).toBe(true);
  });
});

describe("splitDegradationWindows", () => {
  it("splits newest-first times into recent and baseline slices", () => {
    const times = Array.from({ length: 15 }, (_, i) => i);
    const { recentTimes, baselineTimes } = splitDegradationWindows(times);
    expect(recentTimes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(baselineTimes).toEqual([10, 11, 12, 13, 14]);
  });

  it("caps baseline window at BASELINE_WINDOW samples", () => {
    const times = Array.from({ length: 60 }, (_, i) => i);
    const { recentTimes, baselineTimes } = splitDegradationWindows(times);
    expect(recentTimes).toHaveLength(DEGRADATION_RECENT_WINDOW);
    expect(baselineTimes).toHaveLength(DEGRADATION_BASELINE_WINDOW);
    expect(baselineTimes[0]).toBe(DEGRADATION_RECENT_WINDOW);
  });
});

describe("splitDegradationWindowsFromRows", () => {
  it("counts checks for recent window so null latency does not pull baseline forward", () => {
    const rows = [
      { responseTimeMs: null },
      ...Array.from({ length: DEGRADATION_RECENT_WINDOW - 1 }, () => ({
        responseTimeMs: 100,
      })),
      ...Array.from({ length: 20 }, () => ({ responseTimeMs: 500 })),
    ];
    const { recentTimes, baselineTimes } = splitDegradationWindowsFromRows(rows);
    expect(recentTimes).toHaveLength(DEGRADATION_RECENT_WINDOW - 1);
    expect(recentTimes.every((t) => t === 100)).toBe(true);
    expect(baselineTimes).toHaveLength(20);
    expect(baselineTimes.every((t) => t === 500)).toBe(true);
  });
});

describe("computeDegradationSnapshotFromHistory", () => {
  it("matches evaluateDegradation layout for newest-first history", () => {
    const newestFirst = [
      ...Array.from({ length: DEGRADATION_RECENT_WINDOW }, () => 1000),
      ...Array.from({ length: 20 }, () => 200),
    ];
    const snapshot = computeDegradationSnapshotFromHistory(newestFirst);
    expect(snapshot?.isDegraded).toBe(true);
  });
});
