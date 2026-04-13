export type MonitorRadialKind = "paused" | "unknown" | "down" | "up";

/** Radial glow anchored to the top edge (at 50% 0%), light + dark variants — shared by monitor cards and detail hero. */
export const MONITOR_RADIAL_GRADIENTS: Record<
  MonitorRadialKind,
  { light: string; dark: string }
> = {
  up: {
    light:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(16 185 129 / 0.28) 0%, rgb(16 185 129 / 0.09) 28%, transparent 50%)",
    dark:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(52 211 153 / 0.22) 0%, rgb(52 211 153 / 0.07) 28%, transparent 50%)",
  },
  down: {
    light:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(239 68 68 / 0.28) 0%, rgb(239 68 68 / 0.09) 28%, transparent 50%)",
    dark:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(248 113 113 / 0.24) 0%, rgb(248 113 113 / 0.08) 28%, transparent 50%)",
  },
  unknown: {
    light:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(245 158 11 / 0.26) 0%, rgb(245 158 11 / 0.08) 28%, transparent 50%)",
    dark:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(251 191 36 / 0.2) 0%, rgb(251 191 36 / 0.07) 28%, transparent 50%)",
  },
  paused: {
    light:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(120 113 108 / 0.2) 0%, rgb(120 113 108 / 0.06) 28%, transparent 50%)",
    dark:
      "radial-gradient(ellipse 85% 56% at 50% 0%, rgb(168 162 158 / 0.16) 0%, rgb(168 162 158 / 0.05) 28%, transparent 50%)",
  },
};

export function getMonitorRadialKindFromLatest(
  paused: boolean | null | undefined,
  latest: { ok: boolean } | undefined | null
): MonitorRadialKind {
  if (paused) return "paused";
  if (latest == null) return "unknown";
  return latest.ok ? "up" : "down";
}

export function getMonitorRadialKindFromLastOk(
  paused: boolean,
  lastOk: boolean | null
): MonitorRadialKind {
  if (paused) return "paused";
  if (lastOk === null) return "unknown";
  return lastOk ? "up" : "down";
}
