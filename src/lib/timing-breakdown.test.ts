import { describe, expect, it } from "vitest";
import { breakdownCheck, breakdownTotal, summarizeTimings, type TimingSample } from "./timing-breakdown";

function sample(overrides: Partial<TimingSample> = {}): TimingSample {
  return {
    ok: true,
    responseTimeMs: 300,
    dnsMs: 20,
    connectMs: 30,
    tlsMs: 50,
    ttfbMs: 280,
    ...overrides,
  };
}

describe("breakdownCheck", () => {
  it("splits an HTTPS check into sequential phases", () => {
    expect(breakdownCheck(sample())).toEqual({ dns: 20, connect: 30, tls: 50, server: 200, download: 20 });
  });

  it("omits TLS for plain HTTP", () => {
    expect(breakdownCheck(sample({ tlsMs: null }))).toMatchObject({ tls: null, server: 250 });
  });

  it("treats legacy rows with duplicated TCP+TLS time as connect only", () => {
    expect(breakdownCheck(sample({ connectMs: 80, tlsMs: 80 }))).toMatchObject({
      connect: 80,
      tls: null,
      server: 200,
    });
  });

  it("clamps negative derived phases", () => {
    expect(breakdownCheck(sample({ ttfbMs: 60, responseTimeMs: 50 }))).toMatchObject({ server: 0, download: 0 });
  });

  it("handles TCP checks with only DNS and connect", () => {
    expect(
      breakdownCheck(sample({ tlsMs: null, ttfbMs: null, responseTimeMs: 55, dnsMs: 5, connectMs: 50 })),
    ).toEqual({ dns: 5, connect: 50, tls: null, server: null, download: null });
  });

  it("returns null for checks without timings", () => {
    expect(breakdownCheck(sample({ dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: null }))).toBeNull();
  });
});

describe("summarizeTimings", () => {
  it("uses the newest successful check and per-phase medians", () => {
    const summary = summarizeTimings([
      sample({ ok: false, connectMs: 999 }),
      sample({ connectMs: 10 }),
      sample({ connectMs: 30 }),
      sample({ connectMs: 50, dnsMs: null }),
    ]);

    expect(summary?.sampleCount).toBe(3);
    expect(summary?.latest.connect).toBe(10);
    expect(summary?.median.connect).toBe(30);
    expect(summary?.median.dns).toBe(20);
  });

  it("averages the middle pair for an even count", () => {
    const summary = summarizeTimings([sample({ dnsMs: 10 }), sample({ dnsMs: 21 })]);
    expect(summary?.median.dns).toBe(16);
  });

  it("returns null when no successful check has timings", () => {
    expect(summarizeTimings([sample({ ok: false })])).toBeNull();
    expect(summarizeTimings([])).toBeNull();
  });
});

describe("breakdownTotal", () => {
  it("sums known phases", () => {
    expect(breakdownTotal({ dns: 20, connect: 30, tls: null, server: 200, download: 0 })).toBe(250);
  });
});
