import type { Monitor } from "@/db/schema";

/** True when the user has acknowledged the current down episode. */
export function isDowntimeAcked(
  m: Pick<Monitor, "currentStatus" | "lastStatusChangedAt" | "downtimeAckEpisodeAt">
): boolean {
  if (m.currentStatus !== false || !m.lastStatusChangedAt || !m.downtimeAckEpisodeAt) {
    return false;
  }
  return (
    m.downtimeAckEpisodeAt.getTime() === m.lastStatusChangedAt.getTime()
  );
}
