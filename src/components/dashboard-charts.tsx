"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export type FleetSlice = {
  key: "up" | "down" | "paused" | "unknown";
  value: number;
};

export type ActivityDayPoint = {
  day: string;
  down: number;
  recovered: number;
  degraded: number;
};

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

const SLICE_FILL: Record<FleetSlice["key"], string> = {
  up: "var(--color-status-up)",
  down: "var(--color-status-down)",
  paused: "var(--color-text-muted)",
  unknown: "var(--color-border-muted)",
};

function ChartTooltipFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      {children}
    </div>
  );
}

function formatDayTick(isoDay: string, locale: string) {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
}

function FleetTooltip({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: { payload: FleetSlice }[];
  labels: Record<FleetSlice["key"], string>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <ChartTooltipFrame>
      <p className="font-medium text-text-primary">{labels[row.key]}</p>
      <p className="mt-0.5 tabular-nums text-text-muted">{row.value}</p>
    </ChartTooltipFrame>
  );
}

function VolumeTooltip({
  active,
  payload,
  label,
  locale,
  tDown,
  tRecovered,
  tDegraded,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: string;
  locale: string;
  tDown: string;
  tRecovered: string;
  tDegraded: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const names: Record<string, string> = {
    down: tDown,
    recovered: tRecovered,
    degraded: tDegraded,
  };
  return (
    <ChartTooltipFrame>
      <p className="text-text-muted">{formatDayTick(label, locale)}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((p) => {
          const key = String(p.dataKey ?? "");
          if (!p.value) return null;
          return (
            <li key={key} className="tabular-nums text-text-primary">
              {names[key] ?? key}: {p.value}
            </li>
          );
        })}
      </ul>
    </ChartTooltipFrame>
  );
}

export function FleetMix({
  fleet,
  totalCount,
}: {
  fleet: FleetSlice[];
  totalCount: number;
}) {
  const t = useTranslations("overview");
  const uid = useId().replace(/:/g, "");
  const sliceLabels: Record<FleetSlice["key"], string> = {
    up: t("kpiUp"),
    down: t("kpiDown"),
    paused: t("kpiPaused"),
    unknown: t("kpiUnknown"),
  };
  const fleetData = fleet.filter((s) => s.value > 0);

  if (fleetData.length === 0) return null;

  return (
    <section className="shrink-0" aria-labelledby={`${uid}-fleet`}>
      <h2 id={`${uid}-fleet`} className="sr-only">
        {t("chartFleet")}
      </h2>
      <div className="flex items-center gap-4">
        <div
          className="relative size-[148px] shrink-0"
          role="img"
          aria-label={t("chartFleetAria", {
            up: fleet.find((s) => s.key === "up")?.value ?? 0,
            down: fleet.find((s) => s.key === "down")?.value ?? 0,
            paused: fleet.find((s) => s.key === "paused")?.value ?? 0,
            unknown: fleet.find((s) => s.key === "unknown")?.value ?? 0,
          })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fleetData}
                dataKey="value"
                nameKey="key"
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={46}
                outerRadius={68}
                paddingAngle={fleetData.length > 1 ? 2.5 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {fleetData.map((s) => (
                  <Cell key={s.key} fill={SLICE_FILL[s.key]} />
                ))}
              </Pie>
              <Tooltip content={<FleetTooltip labels={sliceLabels} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-semibold tabular-nums leading-none text-text-primary">
              {totalCount}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t("kpiTotal")}
            </span>
          </div>
        </div>
        <ul className="flex min-w-[7.5rem] flex-col gap-1.5 text-sm">
          {fleetData.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: SLICE_FILL[s.key] }}
                aria-hidden
              />
              <span className="text-text-muted">{sliceLabels[s.key]}</span>
              <span className="ml-auto tabular-nums font-medium text-text-primary">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ActivityVolumeChart({ activityByDay }: { activityByDay: ActivityDayPoint[] }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const volumeHasEvents = activityByDay.some((d) => d.down + d.recovered + d.degraded > 0);

  const legend = [
    { key: "down", label: t("down"), fill: "var(--color-status-down)" },
    { key: "recovered", label: t("chartRecovered"), fill: "var(--color-status-up)" },
    { key: "degraded", label: t("degraded"), fill: "var(--color-status-warn)" },
  ] as const;

  if (!volumeHasEvents) return null;

  return (
    <>
      <div className="h-[152px] w-full" role="img" aria-label={t("chartVolume")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activityByDay}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="22%"
            maxBarSize={22}
          >
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
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <VolumeTooltip
                  locale={locale}
                  tDown={t("down")}
                  tRecovered={t("chartRecovered")}
                  tDegraded={t("degraded")}
                />
              }
              cursor={{ fill: "var(--color-border)", opacity: 0.4 }}
            />
            <Bar
              dataKey="down"
              stackId="evt"
              fill="var(--color-status-down)"
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Bar
              dataKey="recovered"
              stackId="evt"
              fill="var(--color-status-up)"
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Bar
              dataKey="degraded"
              stackId="evt"
              fill="var(--color-status-warn)"
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
        {legend.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: item.fill }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </>
  );
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
