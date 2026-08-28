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
                innerRadius={46}
                outerRadius={68}
                paddingAngle={fleetData.length > 1 ? 2 : 0}
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
      <div className="h-[148px] w-full" role="img" aria-label={t("chartVolume")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activityByDay}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="28%"
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
              isAnimationActive={false}
            />
            <Bar
              dataKey="recovered"
              stackId="evt"
              fill="var(--color-status-up)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="degraded"
              stackId="evt"
              fill="var(--color-status-warn)"
              radius={[3, 3, 0, 0]}
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
