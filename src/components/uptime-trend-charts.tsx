"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { TooltipProps } from "recharts";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

export type ChartResultRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  responseTimeMs: number | null;
};

type ScatterPoint = {
  x: number;
  y: number;
  ok: boolean;
  label: string;
  ms: number | null;
};

// ─── formatters ───────────────────────────────────────────────────────────────

function formatAxisTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTickTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── tooltips ─────────────────────────────────────────────────────────────────

function ResponseTooltip({
  active,
  payload,
  label,
  labelUp,
  labelDown,
  labelResponse,
}: TooltipProps<number, string> & { labelUp: string; labelDown: string; labelResponse: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartResultRow;
  const ms = row.responseTimeMs;
  const timeLabel = typeof label === "string" ? formatAxisTime(label) : String(label);
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-text-muted">{timeLabel}</p>
      <p className="mt-1 font-medium text-text-primary">{row.ok ? labelUp : labelDown}</p>
      <p className="mt-0.5 text-text-muted">
        {labelResponse}:{" "}
        {ms != null ? (
          <span className="font-medium text-text-primary">{ms} ms</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </p>
    </div>
  );
}

function HistTooltip({
  active,
  payload,
  labelCheck,
  labelChecks,
}: TooltipProps<number, string> & { labelCheck: string; labelChecks: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { range: string; count: number };
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-text-primary">{d.range}</p>
      <p className="mt-0.5 text-text-muted">
        <span className="font-medium text-text-primary">{d.count}</span>{" "}
        {d.count !== 1 ? labelChecks : labelCheck}
      </p>
    </div>
  );
}

function ScatterTooltip({
  active,
  payload,
  labelUp,
  labelDown,
  labelResponse,
}: TooltipProps<number, string> & { labelUp: string; labelDown: string; labelResponse: string }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as ScatterPoint;
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-text-muted">{pt.label}</p>
      <p className={`mt-1 font-medium ${pt.ok ? "text-text-primary" : "text-red-500"}`}>
        {pt.ok ? labelUp : labelDown}
      </p>
      {pt.ok && pt.ms != null && (
        <p className="mt-0.5 text-text-muted">
          {labelResponse}: <span className="font-medium text-text-primary">{pt.ms} ms</span>
        </p>
      )}
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export function UptimeTrendCharts({
  results,
  baselineP75Ms,
  degradationAlertEnabled,
}: {
  results: ChartResultRow[];
  baselineP75Ms?: number | null;
  degradationAlertEnabled?: boolean | null;
}) {
  const t = useTranslations("monitorDetail");
  const gradientId = useId().replace(/:/g, "");

  if (results.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
        {t("chartNoData")}
      </div>
    );
  }

  const chronological = [...results].reverse();
  const upCount = chronological.filter((r) => r.ok).length;
  const downCount = chronological.length - upCount;

  // ── histogram buckets (successful checks only) ───────────────────────────
  const histBuckets = (() => {
    const b = [
      { range: "<100 ms", count: 0 },
      { range: "100–300 ms", count: 0 },
      { range: "300 ms–1 s", count: 0 },
      { range: ">1 s", count: 0 },
    ];
    for (const r of chronological) {
      if (!r.ok || r.responseTimeMs == null) continue;
      if (r.responseTimeMs < 100) b[0].count++;
      else if (r.responseTimeMs < 300) b[1].count++;
      else if (r.responseTimeMs < 1000) b[2].count++;
      else b[3].count++;
    }
    return b;
  })();

  const histColors = [
    "var(--color-accent)",
    "var(--color-accent)",
    "#f59e0b",
    "#ef4444",
  ];
  const hasHistData = histBuckets.some((b) => b.count > 0);

  // ── scatter points ────────────────────────────────────────────────────────
  const allScatterPoints: ScatterPoint[] = chronological.map((r) => ({
    x: new Date(r.createdAt).getTime(),
    y: r.ok && r.responseTimeMs != null ? r.responseTimeMs : 0,
    ok: r.ok,
    label: formatAxisTime(r.createdAt),
    ms: r.responseTimeMs,
  }));
  const scatterOk = allScatterPoints.filter((p) => p.ok && p.y > 0);
  const scatterFailed = allScatterPoints.filter((p) => !p.ok);

  // ── baseline comparison ───────────────────────────────────────────────────
  const recentOkTimes = chronological
    .slice(-5)
    .filter((r) => r.ok && r.responseTimeMs != null)
    .map((r) => r.responseTimeMs as number);
  const recentAvgMs =
    recentOkTimes.length > 0
      ? Math.round(recentOkTimes.reduce((a, b) => a + b, 0) / recentOkTimes.length)
      : null;
  const showBaseline =
    degradationAlertEnabled && baselineP75Ms != null && recentAvgMs != null;
  const baselineMax = showBaseline
    ? Math.max(baselineP75Ms as number, recentAvgMs as number)
    : 1;
  const ratio = showBaseline
    ? (recentAvgMs as number) / (baselineP75Ms as number)
    : null;
  const ratioColor =
    ratio == null
      ? "text-text-muted"
      : ratio <= 1
        ? "text-emerald-600 dark:text-emerald-400"
        : ratio <= 2
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400";

  return (
    <div className="mt-4 space-y-8">

      {/* ── 1. Uptime bar ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {t("chartUptime")}
        </p>
        <div
          className="mt-2 flex h-8 w-full gap-px"
          aria-label={`${upCount} successful checks, ${downCount} failed checks`}
        >
          {chronological.map((r) => (
            <span
              key={r.id}
              className={`min-w-[3px] flex-1 rounded-sm transition-opacity hover:opacity-70 ${
                r.ok
                  ? "bg-emerald-500 dark:bg-emerald-600"
                  : "bg-red-500 dark:bg-red-600"
              }`}
              title={`${formatAxisTime(r.createdAt)} · ${r.ok ? t("statusBadgeUp") : t("statusBadgeDown")}`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>{t("chartOlder")}</span>
          <span>{t("chartNewer")}</span>
        </div>
      </div>

      {/* ── 2. Response time trend ──────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {t("chartResponseTrend")}
        </p>
        <div className="mt-2 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chronological}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="createdAt"
                tickFormatter={formatAxisTime}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={(v) => `${v} ms`}
                domain={[0, "auto"]}
                width={52}
              />
              <Tooltip
                content={
                  <ResponseTooltip
                    labelUp={t("statusBadgeUp")}
                    labelDown={t("statusBadgeDown")}
                    labelResponse={t("tooltipResponse")}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="responseTimeMs"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-accent)" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 3. Response time distribution ───────────────────────────────── */}
      {hasHistData && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("chartDistribution")}
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">{t("chartDistributionSub")}</p>
          <div className="mt-2 h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histBuckets}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  allowDecimals={false}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <HistTooltip
                      labelCheck={t("tooltipCheck")}
                      labelChecks={t("tooltipChecks")}
                    />
                  }
                  cursor={{ fill: "var(--color-border)", opacity: 0.4 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {histBuckets.map((_, i) => (
                    <Cell key={i} fill={histColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 4. Check dot timeline ────────────────────────────────────────── */}
      {allScatterPoints.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("chartTimeline")}
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {t("chartTimelineSub")}
          </p>
          <div className="mt-2 h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={["auto", "auto"]}
                  tickFormatter={formatTickTime}
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  scale="time"
                  tickCount={5}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                  tickFormatter={(v) => `${v} ms`}
                  domain={[0, "auto"]}
                  width={52}
                />
                <ZAxis range={[28, 28]} />
                <Tooltip
                  content={
                    <ScatterTooltip
                      labelUp={t("statusBadgeUp")}
                      labelDown={t("statusBadgeDown")}
                      labelResponse={t("tooltipResponse")}
                    />
                  }
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter
                  data={scatterOk}
                  fill="var(--color-accent)"
                  opacity={0.7}
                  isAnimationActive={false}
                />
                <Scatter
                  data={scatterFailed}
                  fill="#ef4444"
                  opacity={0.85}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 5. Baseline vs recent comparison ─────────────────────────────── */}
      {showBaseline && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("chartBaseline")}
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {t("chartBaselineSub")}
          </p>
          <div className="mt-3 space-y-3">
            {([
              { label: t("chartBaselineP75"), value: baselineP75Ms as number, color: "var(--color-accent)" },
              { label: t("chartRecentAvg"), value: recentAvgMs as number, color: ratio != null && ratio > 2 ? "#ef4444" : ratio != null && ratio > 1 ? "#f59e0b" : "var(--color-accent)" },
            ] as const).map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">{row.label}</span>
                  <span className="font-medium tabular-nums text-text-primary">{row.value} ms</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((row.value / baselineMax) * 100))}%`,
                      background: row.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {ratio != null && (
              <p className={`text-[11px] font-medium ${ratioColor}`}>
                {ratio <= 1
                  ? t("chartWithinBaseline", { pct: (ratio * 100).toFixed(0) })
                  : t("chartAboveBaseline", { ratio: ratio.toFixed(1) })}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
