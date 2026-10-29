/**
 * Time formatting utilities
 */

/**
 * Format a duration string (e.g., "<1m", "5m", "2h", "2h 15m", "3d")
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

  if (diffMin < 1) return "<1m";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;

  if (diffHr < 24) {
    return remainMin > 0 ? `${diffHr}h ${remainMin}m` : `${diffHr}h`;
  }
  return `${Math.floor(diffHr / 24)}d`;
}
