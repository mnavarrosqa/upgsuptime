const DISMISSED_PREFIX = "upgs.degradationCallout.dismissed:";
const GLOBAL_DEFER_KEY = "upgs.degradationCallout.globalDefer";

export function isDegradationCalloutDismissed(monitorId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${DISMISSED_PREFIX}${monitorId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissDegradationCalloutForMonitor(monitorId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DISMISSED_PREFIX}${monitorId}`, "1");
    window.localStorage.setItem(GLOBAL_DEFER_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearDegradationCalloutDismissed(monitorId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${DISMISSED_PREFIX}${monitorId}`);
  } catch {
    // ignore
  }
}

export function isGlobalDegradationDeferHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GLOBAL_DEFER_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearGlobalDegradationDeferHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GLOBAL_DEFER_KEY);
  } catch {
    // ignore
  }
}
