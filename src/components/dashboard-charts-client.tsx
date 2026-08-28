"use client";

import dynamic from "next/dynamic";
import type { DashboardChartsProps } from "@/components/dashboard-charts";

const DashboardChartsInner = dynamic(
  () => import("@/components/dashboard-charts").then((m) => ({ default: m.DashboardCharts })),
  {
    ssr: false,
    loading: () => <div className="mt-8 h-[360px] animate-pulse rounded-lg bg-border/40" />,
  }
);

export function DashboardChartsClient(props: DashboardChartsProps) {
  return <DashboardChartsInner {...props} />;
}
