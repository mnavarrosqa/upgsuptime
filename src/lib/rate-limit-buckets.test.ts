import { describe, expect, it } from "vitest";
import { pruneExpiredBuckets, type RateLimitBucket } from "./rate-limit-buckets";

describe("pruneExpiredBuckets", () => {
  it("leaves small stores untouched", () => {
    const store = new Map<string, RateLimitBucket>([["a", { count: 1, resetAt: 0 }]]);
    pruneExpiredBuckets(store, 1000);
    expect(store.size).toBe(1);
  });

  it("drops only expired buckets once the store is large", () => {
    const store = new Map<string, RateLimitBucket>();
    for (let i = 0; i < 10_000; i++) store.set(`ip-${i}`, { count: 1, resetAt: 500 });
    store.set("live", { count: 3, resetAt: 5000 });
    pruneExpiredBuckets(store, 1000);
    expect([...store.keys()]).toEqual(["live"]);
  });
});
