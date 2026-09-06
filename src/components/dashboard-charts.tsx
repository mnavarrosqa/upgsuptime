"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export type RankingPoint = {
  id: string;
  name: string;
  n: number;
  href: string;
  url: string;
  type: string;
};

export type FleetTrendPoint = {
  day: string;
  total: number;
  okCount: number;
  uptimePct: number | null;
  avgMs: number | null;
};

function ChartTooltipFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      {children}
    </div>
  );
}

function formatDayTick(isoDay: string, locale: string) {
  const d = new Date(`${isoDay}T12:00:00`);
  return d.toLocaleDateString(locale, { weekday: "short" });
}

function TrendTooltip({
  active,
  payload,
  label,
  locale,
  unit,
  checksLabel,
}: {
  active?: boolean;
  payload?: { value?: number | null; payload?: FleetTrendPoint }[];
  label?: string;
  locale: string;
  unit: "pct" | "ms";
  checksLabel: (n: number) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  const value = payload[0]?.value;
  if (value == null) return null;
  const row = payload[0]?.payload;
  const checks = unit === "pct" ? (row?.total ?? 0) : (row?.okCount ?? 0);
  const display = unit === "pct" ? `${value}%` : `${value} ms`;
  return (
    <ChartTooltipFrame>
      <p className="text-text-muted">{formatDayTick(label, locale)}</p>
      <p className="mt-0.5 tabular-nums text-text-primary">{display}</p>
      {checks > 0 ? (
        <p className="mt-0.5 text-text-muted">{checksLabel(checks)}</p>
      ) : null}
    </ChartTooltipFrame>
  );
}

function uptimeYDomain(points: FleetTrendPoint[]): [number, number] {
  const vals = points.flatMap((p) => (p.uptimePct == null ? [] : [p.uptimePct]));
  if (vals.length === 0) return [0, 100];
  const min = Math.min(...vals);
  if (min >= 99.5) return [99, 100];
  if (min >= 95) return [94, 100];
  return [0, 100];
}

export function FleetTrendCharts({ trend }: { trend: FleetTrendPoint[] }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const hasUptime = trend.some((d) => d.uptimePct != null);
  const hasMs = trend.some((d) => d.avgMs != null);
  if (!hasUptime && !hasMs) return null;

  const uptimeDots = trend.filter((d) => d.uptimePct != null).length <= 2;
  const msDots = trend.filter((d) => d.avgMs != null).length <= 2;
  const checksLabel = (n: number) => t("chartTrendChecks", { n });
  const grid = hasUptime && hasMs ? "grid gap-8 lg:grid-cols-2" : "grid gap-8";

  return (
    <div className={grid}>
      {hasUptime ? (
        <div>
          <p className="text-[11px] font-medium text-text-muted">{t("chartUptimeTrend")}</p>
          <div className="mt-2 h-[152px] w-full" role="img" aria-label={t("chartUptimeTrend")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}-up`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-status-up)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--color-status-up)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => formatDayTick(d, locale)}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={uptimeYDomain(trend)}
                  width={36}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TrendTooltip locale={locale} unit="pct" checksLabel={checksLabel} />}
                  cursor={{ stroke: "var(--color-border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="uptimePct"
                  stroke="var(--color-status-up)"
                  strokeWidth={2}
                  fill={`url(#${uid}-up)`}
                  connectNulls={false}
                  dot={uptimeDots ? { r: 3, fill: "var(--color-status-up)" } : false}
                  activeDot={{ r: 4, fill: "var(--color-status-up)" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      {hasMs ? (
        <div>
          <p className="text-[11px] font-medium text-text-muted">{t("chartResponseTrend")}</p>
          <div className="mt-2 h-[152px] w-full" role="img" aria-label={t("chartResponseTrend")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}-ms`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => formatDayTick(d, locale)}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, "auto"]}
                  width={44}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TrendTooltip locale={locale} unit="ms" checksLabel={checksLabel} />}
                  cursor={{ stroke: "var(--color-border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="avgMs"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill={`url(#${uid}-ms)`}
                  connectNulls={false}
                  dot={msDots ? { r: 3, fill: "var(--color-accent)" } : false}
                  activeDot={{ r: 4, fill: "var(--color-accent)" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
