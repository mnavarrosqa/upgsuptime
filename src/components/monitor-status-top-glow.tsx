import { cn } from "@/lib/utils";
import {
  MONITOR_RADIAL_GRADIENTS,
  type MonitorRadialKind,
} from "@/lib/monitor-radial-glow";

const radialBaseClass =
  "pointer-events-none absolute inset-x-0 top-0 z-[1] h-[3rem] bg-no-repeat motion-safe:animate-monitor-card-radial-glow origin-[50%_0%]";

/** Status-colored radial highlight flush to the top edge of a card (list cards + detail hero). */
export function MonitorStatusTopGlow({ kind }: { kind: MonitorRadialKind }) {
  const g = MONITOR_RADIAL_GRADIENTS[kind];
  return (
    <>
      <div
        aria-hidden
        className={cn(radialBaseClass, "dark:hidden")}
        style={{ backgroundImage: g.light }}
      />
      <div
        aria-hidden
        className={cn(radialBaseClass, "hidden dark:block")}
        style={{ backgroundImage: g.dark }}
      />
    </>
  );
}
