"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  LabelList,
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
};

export type DashboardChartsProps = {
  fleet: FleetSlice[];
  totalCount: number;
  activityByDay: ActivityDayPoint[];
  worstUptime: RankingPoint[];
  slowest: RankingPoint[];
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

function truncateLabel(name: string, max = 16) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
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

function RankingTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: RankingPoint }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <ChartTooltipFrame>
      <p className="font-medium text-text-primary">{row.name}</p>
      <p className="mt-0.5 tabular-nums text-text-muted">
        {unit === "%" ? `${row.n}%` : `${row.n} ${unit}`}
      </p>
    </ChartTooltipFrame>
  );
}

export function DashboardCharts({
  fleet,
  totalCount,
  activityByDay,
  worstUptime,
  slowest,
}: DashboardChartsProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const sliceLabels: Record<FleetSlice["key"], string> = {
    up: t("kpiUp"),
    down: t("kpiDown"),
    paused: t("kpiPaused"),
    unknown: t("kpiUnknown"),
  };
  const fleetData = fleet.filter((s) => s.value > 0);
  const volumeHasEvents = activityByDay.some(
    (d) => d.down + d.recovered + d.degraded > 0
  );

  return (
    <div className="mt-8 space-y-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby={`${uid}-fleet`}>
          <h2
            id={`${uid}-fleet`}
            className="text-xs font-semibold uppercase tracking-wider text-text-muted"
          >
            {t("chartFleet")}
          </h2>
          {fleetData.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">{t("noUptimeData")}</p>
          ) : (
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="relative h-[168px] w-full max-w-[168px] shrink-0"
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
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={fleetData.length > 1 ? 2 : 0}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {fleetData.map((s) => (
                        <Cell key={s.key} fill={SLICE_FILL[s.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<FleetTooltip labels={sliceLabels} />}
                    />
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
              <ul className="flex flex-col gap-2 text-sm">
                {fleetData.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: SLICE_FILL[s.key] }}
                      aria-hidden
                    />
                    <span className="text-text-muted">{sliceLabels[s.key]}</span>
                    <span className="ml-auto tabular-nums font-medium text-text-primary">
                      {s.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby={`${uid}-volume`}>
          <h2
            id={`${uid}-volume`}
            className="text-xs font-semibold uppercase tracking-wider text-text-muted"
          >
            {t("chartVolume")}
          </h2>
          <p className="mt-0.5 text-[11px] text-text-muted">{t("chartVolumeSub")}</p>
          {!volumeHasEvents ? (
            <p className="mt-3 text-sm text-text-muted">{t("activityEmpty")}</p>
          ) : (
            <div
              className="mt-2 h-[168px] w-full"
              role="img"
              aria-label={t("chartVolume")}
            >
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
          )}
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <RankingChart
          title={t("worstUptime")}
          empty={t("noUptimeData")}
          data={worstUptime}
          unit="%"
          domain={[0, 100]}
          fillFor={(n) =>
            n < 99 ? "var(--color-status-down)" : "var(--color-status-up)"
          }
        />
        <RankingChart
          title={t("slowest")}
          empty={t("noLatencyData")}
          data={slowest}
          unit="ms"
          domain={[0, "auto"]}
          fillFor={() => "var(--color-accent)"}
        />
      </div>
    </div>
  );
}

function RankingChart({
  title,
  empty,
  data,
  unit,
  domain,
  fillFor,
}: {
  title: string;
  empty: string;
  data: RankingPoint[];
  unit: string;
  domain: [number, number | "auto"];
  fillFor: (n: number) => string;
}) {
  const router = useRouter();
  const height = Math.max(128, data.length * 36);

  if (data.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h2>
        <p className="mt-3 text-sm text-text-muted">{empty}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div
        className="mt-2 w-full"
        style={{ height }}
        role="img"
        aria-label={title}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
            barCategoryGap="22%"
          >
            <XAxis
              type="number"
              domain={domain}
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={108}
              tick={{ fontSize: 11, fill: "var(--color-text-primary)" }}
              tickFormatter={(v) => truncateLabel(String(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<RankingTooltip unit={unit} />} cursor={{ fill: "var(--color-border)", opacity: 0.35 }} />
            <Bar
              dataKey="n"
              radius={[0, 3, 3, 0]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(d) => {
                const href = (d as { payload?: RankingPoint }).payload?.href;
                if (href) router.push(href);
              }}
            >
              {data.map((row) => (
                <Cell key={row.id} fill={fillFor(row.n)} />
              ))}
              <LabelList
                dataKey="n"
                position="right"
                fill="var(--color-text-muted)"
                fontSize={10}
                formatter={(v: number) => (unit === "%" ? `${v}%` : `${v}`)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {data.map((row) => (
          <li key={row.id}>
            <Link href={row.href}>
              {row.name}: {unit === "%" ? `${row.n}%` : `${row.n} ${unit}`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
