/** Bound JSON array size so the user row does not grow without limit. */
export const MAX_ACTIVITY_DISMISSED_IDS = 400;

export function parseActivityDismissedIds(
  raw: string | null | undefined
): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr.filter((x): x is string => typeof x === "string" && x.length > 0)
    );
  } catch {
    return new Set();
  }
}

export function appendActivityDismissedId(
  raw: string | null | undefined,
  id: string
): string {
  const prev: string[] = [];
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        for (const x of arr) {
          if (typeof x === "string" && x.length > 0) prev.push(x);
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (prev.includes(id)) {
    return JSON.stringify(prev.slice(-MAX_ACTIVITY_DISMISSED_IDS));
  }
  const next = [...prev, id].slice(-MAX_ACTIVITY_DISMISSED_IDS);
  return JSON.stringify(next);
}
