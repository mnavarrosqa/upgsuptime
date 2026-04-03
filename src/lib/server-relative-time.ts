/**
 * Wall-clock bounds for server-side queries. `Date.now()` is intentionally
 * non-idempotent; these helpers isolate that to one place.
 */
export function hoursAgoUtc(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function daysAgoUtc(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Epoch ms for relative-age math in server components (not a React render tree). */
export function unixNowMs(): number {
  return Date.now();
}
