export const TIMING_PHASES = ["dns", "connect", "tls", "server", "download"] as const;

export type TimingPhase = (typeof TIMING_PHASES)[number];

export type TimingSample = {
  ok: boolean;
  responseTimeMs: number | null;
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
};

export type TimingBreakdown = Record<TimingPhase, number | null>;

function nonNegative(value: number): number {
  return Math.max(0, Math.round(value));
}

/**
 * Splits one check into sequential phases. `ttfbMs` is measured from the start of
 * the request (after the pre-request DNS lookup), so server wait is TTFB minus the
 * connection phases, and download is whatever the response took after TTFB.
 * Returns null when the check carries no phase timings.
 */
export function breakdownCheck(sample: TimingSample): TimingBreakdown | null {
  const { dnsMs, connectMs, ttfbMs, responseTimeMs } = sample;
  let { tlsMs } = sample;
  if (dnsMs == null && connectMs == null && ttfbMs == null) return null;

  // Checks stored before TLS was timed separately wrote the TCP+TLS total into
  // both columns; treat those as connect time only.
  if (connectMs != null && tlsMs != null && tlsMs > 0 && tlsMs === connectMs) {
    tlsMs = null;
  }

  const handshake = (connectMs ?? 0) + (tlsMs ?? 0);
  return {
    dns: dnsMs ?? null,
    connect: connectMs,
    tls: tlsMs ?? null,
    server: ttfbMs != null ? nonNegative(ttfbMs - handshake) : null,
    download:
      ttfbMs != null && responseTimeMs != null ? nonNegative(responseTimeMs - ttfbMs) : null,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export type TimingSummary = {
  latest: TimingBreakdown;
  median: TimingBreakdown;
  sampleCount: number;
};

/**
 * Latest successful check's phases plus the per-phase median across all
 * successful checks with timings. `samples` are newest first.
 */
export function summarizeTimings(samples: TimingSample[]): TimingSummary | null {
  const breakdowns = samples
    .filter((s) => s.ok)
    .map(breakdownCheck)
    .filter((b): b is TimingBreakdown => b !== null);
  if (breakdowns.length === 0) return null;

  const medianBreakdown = Object.fromEntries(
    TIMING_PHASES.map((phase) => [
      phase,
      median(breakdowns.map((b) => b[phase]).filter((v): v is number => v != null)),
    ]),
  ) as TimingBreakdown;

  return { latest: breakdowns[0], median: medianBreakdown, sampleCount: breakdowns.length };
}

export function breakdownTotal(breakdown: TimingBreakdown): number {
  return TIMING_PHASES.reduce((sum, phase) => sum + (breakdown[phase] ?? 0), 0);
}
