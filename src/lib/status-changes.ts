export type MonitorStatusSnapshot = {
  id: string;
  name: string;
  status: "up" | "down" | "pending" | "paused";
  changedAt: string | null;
  acknowledged: boolean;
};

export type StatusChange = { kind: "down" | "recovered"; id: string; name: string };

/**
 * Status transitions between two polls. Monitors first seen in `next` raise
 * nothing (the first poll only sets the baseline), and acknowledged outages
 * stay quiet. A new down episode (changedAt moved) alerts even if both polls
 * saw "down".
 */
export function diffStatuses(
  previous: ReadonlyMap<string, MonitorStatusSnapshot>,
  next: readonly MonitorStatusSnapshot[],
): StatusChange[] {
  const changes: StatusChange[] = [];
  for (const monitor of next) {
    const before = previous.get(monitor.id);
    if (!before) continue;
    if (monitor.status === "down" && !monitor.acknowledged) {
      if (before.status !== "down" || before.changedAt !== monitor.changedAt) {
        changes.push({ kind: "down", id: monitor.id, name: monitor.name });
      }
    } else if (monitor.status === "up" && before.status === "down") {
      changes.push({ kind: "recovered", id: monitor.id, name: monitor.name });
    }
  }
  return changes;
}
