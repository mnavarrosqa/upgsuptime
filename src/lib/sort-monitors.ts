import type { Monitor } from "@/db/schema";

export type LatestByMonitor = Record<string, { ok: boolean; responseTimeMs: number | null }>;

/**
 * Get the comparable value for a monitor based on the sort field.
 */
export function getMonitorSortValue(
  monitor: Monitor,
  field: string,
  latestByMonitor: LatestByMonitor
): string | number | boolean | null {
  switch (field) {
    case "name":
      return monitor.name.toLowerCase();
    case "url":
      return monitor.url.toLowerCase();
    case "lastCheckAt":
      return monitor.lastCheckAt ? new Date(monitor.lastCheckAt).getTime() : null;
    case "createdAt":
      return monitor.createdAt ? new Date(monitor.createdAt).getTime() : null;
    case "intervalMinutes":
      return monitor.intervalMinutes;
    case "paused":
      return monitor.paused;
    case "status":
      const status = latestByMonitor[monitor.id];
      if (status === undefined) return 2; // Unchecked
      return status.ok ? 0 : 1; // Up (0), Down (1)
    case "responseTime":
      const responseTime = latestByMonitor[monitor.id]?.responseTimeMs;
      return responseTime ?? null;
    case "ssl":
      if (!monitor.sslMonitoring) return 2; // Not monitored
      if (monitor.sslValid === null) return 1; // Unknown
      return monitor.sslValid ? 0 : 3; // Valid (0), Invalid (3)
    default:
      return null;
  }
}

/**
 * Sort an array of monitors by the specified field and direction.
 */
export function sortMonitors<T extends Monitor>(
  monitors: T[],
  field: string,
  direction: "asc" | "desc",
  latestByMonitor: LatestByMonitor
): T[] {
  return [...monitors].sort((a, b) => {
    const valueA = getMonitorSortValue(a, field, latestByMonitor);
    const valueB = getMonitorSortValue(b, field, latestByMonitor);

    // Handle null/undefined values - they should always be sorted last
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return direction === "asc" ? 1 : -1;
    if (valueB == null) return direction === "asc" ? -1 : 1;

    // Compare values
    let comparison = 0;
    if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else {
      comparison = (valueA as number) - (valueB as number);
    }

    // Apply direction
    return direction === "asc" ? comparison : -comparison;
  });
}
