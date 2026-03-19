/**
 * Time formatting utilities
 */

/**
 * Format a relative time string (e.g., "Just now", "5m ago", "2h ago", "3d ago")
 * @param date - The date to format (Date object, ISO string, or null)
 * @param nullValue - Value to return when date is null (default: "Never")
 */
export function formatRelativeTime(
  date: Date | string | null,
  nullValue = "Never"
): string {
  if (!date) return nullValue;
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/**
 * Format a duration string (e.g., "just now", "5m", "2h", "2h 15m", "3d")
 * Used for displaying how long something has been down or ongoing.
 * @param date - The start date/time of the duration (Date object, ISO string, or null)
 * @param nullValue - Value to return when date is null (default: "unknown duration")
 */
export function formatDuration(
  date: Date | string | null,
  nullValue = "unknown duration"
): string {
  if (!date) return nullValue;
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;

  if (diffHr < 24) {
    return remainMin > 0 ? `${diffHr}h ${remainMin}m` : `${diffHr}h`;
  }
  return `${Math.floor(diffHr / 24)}d`;
}

/**
 * Format the last checked time (alias for formatRelativeTime)
 * Maintains API compatibility with existing code.
 */
export const formatLastChecked = formatRelativeTime;
