import { describe, expect, it } from "vitest";
import { groupIncidents } from "@/lib/availability";

const MIN = 60_000;

describe("groupIncidents", () => {
  it("returns nothing without failures", () => {
    expect(groupIncidents([], 5 * MIN)).toEqual([]);
  });

  it("merges consecutive failures and adds one interval", () => {
    expect(groupIncidents([0, 5 * MIN, 10 * MIN], 5 * MIN)).toEqual([
      { startMs: 0, durationMs: 15 * MIN },
    ]);
  });

  it("splits incidents when a gap exceeds two intervals", () => {
    const got = groupIncidents([0, 5 * MIN, 60 * MIN], 5 * MIN);
    expect(got).toEqual([
      { startMs: 0, durationMs: 10 * MIN },
      { startMs: 60 * MIN, durationMs: 5 * MIN },
    ]);
  });
});
