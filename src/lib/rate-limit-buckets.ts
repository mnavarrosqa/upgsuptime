export type RateLimitBucket = { count: number; resetAt: number };

/** Prune once a store holds this many keys; keys come from client-supplied IP headers. */
const PRUNE_THRESHOLD = 10_000;

/**
 * Drops expired buckets once the store grows past the threshold, so spoofed
 * `x-forwarded-for` values cannot grow the in-memory map without bound.
 */
export function pruneExpiredBuckets(store: Map<string, RateLimitBucket>, now: number): void {
  if (store.size < PRUNE_THRESHOLD) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}
