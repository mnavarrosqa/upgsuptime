"use client";

import dynamic from "next/dynamic";
import type { ActivityDayPoint, FleetSlice, FleetTrendPoint } from "@/components/dashboard-charts";

const FleetMixInner = dynamic(
  () => import("@/components/dashboard-charts").then((m) => ({ default: m.FleetMix })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-4" aria-hidden>
        <div className="size-[148px] animate-pulse rounded-full bg-border/40" />
        <div className="h-16 w-28 animate-pulse rounded-md bg-border/40" />
      </div>
    ),
  }
);

const ActivityVolumeInner = dynamic(
  () => import("@/components/dashboard-charts").then((m) => ({ default: m.ActivityVolumeChart })),
  {
    ssr: false,
    loading: () => <div className="h-[152px] animate-pulse rounded-lg bg-border/40" />,
  }
);

const FleetTrendInner = dynamic(
  () => import("@/components/dashboard-charts").then((m) => ({ default: m.FleetTrendCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-8 lg:grid-cols-2" aria-hidden>
        <div className="h-[152px] animate-pulse rounded-lg bg-border/40" />
        <div className="h-[152px] animate-pulse rounded-lg bg-border/40" />
      </div>
    ),
  }
);

export function FleetMixClient({
  fleet,
  totalCount,
}: {
  fleet: FleetSlice[];
  totalCount: number;
}) {
  if (fleet.filter((s) => s.value > 0).length <= 1) return null;
  return <FleetMixInner fleet={fleet} totalCount={totalCount} />;
}

export function ActivityVolumeClient({ activityByDay }: { activityByDay: ActivityDayPoint[] }) {
  const hasEvents = activityByDay.some((d) => d.down + d.recovered + d.degraded > 0);
  if (!hasEvents) return null;
  return <ActivityVolumeInner activityByDay={activityByDay} />;
}

export function FleetTrendClient({ trend }: { trend: FleetTrendPoint[] }) {
  if (!trend.some((d) => d.total > 0)) return null;
  return <FleetTrendInner trend={trend} />;
}
