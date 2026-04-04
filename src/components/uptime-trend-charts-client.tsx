"use client";

import dynamic from "next/dynamic";
import type { ChartResultRow } from "@/components/uptime-trend-charts";

const UptimeTrendChartsInner = dynamic(
  () => import("@/components/uptime-trend-charts").then((m) => ({ default: m.UptimeTrendCharts })),
  {
    ssr: false,
    loading: () => <div className="mt-4 h-64 animate-pulse rounded-lg bg-border/50" />,
  }
);

export function UptimeTrendCharts(props: {
  results: ChartResultRow[];
  baselineP75Ms?: number | null;
  degradationAlertEnabled?: boolean | null;
}) {
  return <UptimeTrendChartsInner {...props} />;
}
