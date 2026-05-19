import {
  DEGRADATION_BASELINE_MIN_SAMPLES,
  DEGRADATION_BASELINE_WINDOW,
  DEGRADATION_CLEAR_RATIO,
  DEGRADATION_ENTER_RATIO,
  DEGRADATION_MIN_RECENT_MS,
  DEGRADATION_RECENT_WINDOW,
} from "@/lib/degradation-config";

/** Extra rows fetched so null/invalid response times do not shrink windows. */
export const DEGRADATION_FETCH_BUFFER = 15;

/** 75th percentile (nearest-rank), input must be sorted ascending. */
export function computeP75(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.floor(0.75 * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

export type DegradationSnapshot = {
  baselineP75Ms: number;
  recentP75Ms: number;
  enterThresholdMs: number;
  isDegraded: boolean;
  /** True when recent P75 is below CLEAR_RATIO × baseline (episode may end). */
  shouldClearEpisode: boolean;
};

/**
 * Compute baseline vs recent P75 and whether the monitor is in a degraded state.
 * `recentTimes` and `baselineTimes` are unsorted; each needs enough samples.
 */
export function computeDegradationSnapshot(
  recentTimes: number[],
  baselineTimes: number[],
): DegradationSnapshot | null {
  if (
    recentTimes.length < DEGRADATION_RECENT_WINDOW ||
    baselineTimes.length < DEGRADATION_BASELINE_MIN_SAMPLES
  ) {
    return null;
  }

  const baselineP75Ms = computeP75([...baselineTimes].sort((a, b) => a - b));
  const recentP75Ms = computeP75([...recentTimes].sort((a, b) => a - b));
  const enterThresholdMs = Math.max(
    DEGRADATION_ENTER_RATIO * baselineP75Ms,
    DEGRADATION_MIN_RECENT_MS,
  );
  const isDegraded = recentP75Ms >= enterThresholdMs;
  const shouldClearEpisode = recentP75Ms < DEGRADATION_CLEAR_RATIO * baselineP75Ms;

  return {
    baselineP75Ms,
    recentP75Ms,
    enterThresholdMs,
    isDegraded,
    shouldClearEpisode,
  };
}

/**
 * Split pre-filtered newest-first valid response times into recent + baseline windows.
 * Use only when the input has no gaps (e.g. chart history of successful checks).
 */
export function splitDegradationWindows(timesNewestFirst: number[]): {
  recentTimes: number[];
  baselineTimes: number[];
} {
  const recentTimes = timesNewestFirst.slice(0, DEGRADATION_RECENT_WINDOW);
  const baselineTimes = timesNewestFirst.slice(
    DEGRADATION_RECENT_WINDOW,
    DEGRADATION_RECENT_WINDOW + DEGRADATION_BASELINE_WINDOW,
  );
  return { recentTimes, baselineTimes };
}

/**
 * Split DB rows newest-first, skipping invalid times without collapsing check order.
 * Ensures recent window = N most recent *checks with valid latency*, not N array slots.
 */
export function splitDegradationWindowsFromRows(
  rowsNewestFirst: Array<{ responseTimeMs: number | null }>,
): { recentTimes: number[]; baselineTimes: number[] } {
  const recentTimes: number[] = [];
  const baselineTimes: number[] = [];
  let checksSeen = 0;

  for (const row of rowsNewestFirst) {
    if (checksSeen < DEGRADATION_RECENT_WINDOW) {
      checksSeen++;
      const t = row.responseTimeMs;
      if (t != null && t > 0) recentTimes.push(t);
      continue;
    }
    const t = row.responseTimeMs;
    if (t != null && t > 0) {
      if (baselineTimes.length < DEGRADATION_BASELINE_WINDOW) {
        baselineTimes.push(t);
      } else {
        break;
      }
    }
  }

  return { recentTimes, baselineTimes };
}

export function filterPositiveResponseTimes(
  values: Array<number | null | undefined>,
): number[] {
  return values.filter((t): t is number => t != null && t > 0);
}

/**
 * Chart/history view: compute the same snapshot as evaluateDegradation when enough
 * successful times are present (newest-first). Returns null if data is insufficient.
 */
export function computeDegradationSnapshotFromHistory(
  okTimesNewestFirst: number[],
): DegradationSnapshot | null {
  const times = filterPositiveResponseTimes(okTimesNewestFirst);
  const { recentTimes, baselineTimes } = splitDegradationWindows(times);
  return computeDegradationSnapshot(recentTimes, baselineTimes);
}

export function isDegradationWarmup(baselineSampleCount: number): boolean {
  return baselineSampleCount < DEGRADATION_BASELINE_MIN_SAMPLES;
}
