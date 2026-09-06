"use client";

import dynamic from "next/dynamic";
import type { FleetTrendPoint } from "@/components/dashboard-charts";

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

export function FleetTrendClient({ trend }: { trend: FleetTrendPoint[] }) {
  if (!trend.some((d) => d.total > 0)) return null;
  return <FleetTrendInner trend={trend} />;
}
