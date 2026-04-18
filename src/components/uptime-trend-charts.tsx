"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  Provider as UptimeTooltipProvider,
  Root as UptimeTooltipRoot,
  Trigger as UptimeTooltipTrigger,
  Portal as UptimeTooltipPortal,
  Content as UptimeTooltipContent,
} from "@radix-ui/react-tooltip";
import type { TooltipProps } from "recharts";
import {
  DEGRADATION_ENTER_RATIO,
  DEGRADATION_RECENT_WINDOW,
} from "@/lib/degradation-config";
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
  /** Set when this row is a time-bucket aggregate (averages mode). */
  bucketCheckCount?: number;
};

export type ChartDetailMode = "averages" | "full";

type ScatterPoint = {
  x: number;
  y: number;
  ok: boolean;
  label: string;
  ms: number | null;
  bucketCheckCount?: number;
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

const UPTIME_STRIP_MAX_BUCKETS = 240;
const UPTIME_LAST_HOUR_MS = 60 * 60 * 1000;

/** Oldest→newest checks whose timestamps fall in the hour ending at the latest check. */
function filterChronologicalLastHour(chronological: ChartResultRow[]): ChartResultRow[] {
  if (chronological.length === 0) return [];
  const times = chronological.map((r) => new Date(r.createdAt).getTime());
  const tMax = Math.max(...times);
  const cutoff = tMax - UPTIME_LAST_HOUR_MS;
  return chronological.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}

type UptimeStripSegment = {
  key: string;
  /** True only when bucket has checks and none failed */
  ok: boolean;
  hasData: boolean;
  fromMs: number;
  toMs: number;
  checkCount: number;
  upCount: number;
  downCount: number;
};

/** One segment per check when sparse; time buckets when dense — always fits container width. */
function buildUptimeStripSegments(chronological: ChartResultRow[]): UptimeStripSegment[] {
  const n = chronological.length;
  if (n === 0) return [];

  if (n <= UPTIME_STRIP_MAX_BUCKETS) {
    return chronological.map((r, i) => {
      const t = new Date(r.createdAt).getTime();
      return {
        key: `uptime-${r.id}-${i}`,
        ok: r.ok,
        hasData: true,
        fromMs: t,
        toMs: t,
        checkCount: 1,
        upCount: r.ok ? 1 : 0,
        downCount: r.ok ? 0 : 1,
      };
    });
  }

  const times = chronological.map((r) => new Date(r.createdAt).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = Math.max(tMax - tMin, 1);
  const bucketCount = UPTIME_STRIP_MAX_BUCKETS;

  const up = new Array<number>(bucketCount).fill(0);
  const down = new Array<number>(bucketCount).fill(0);

  for (const r of chronological) {
    const t = new Date(r.createdAt).getTime();
    let idx = Math.floor(((t - tMin) / span) * bucketCount);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    if (r.ok) up[idx]++;
    else down[idx]++;
  }

  return Array.from({ length: bucketCount }, (_, i) => {
    const fromMs = tMin + (span * i) / bucketCount;
    const toMs = tMin + (span * (i + 1)) / bucketCount;
    const upCount = up[i];
    const downCount = down[i];
    const checkCount = upCount + downCount;
    return {
      key: `uptime-bucket-${i}`,
      ok: downCount === 0 && checkCount > 0,
      hasData: checkCount > 0,
      fromMs,
      toMs,
      checkCount,
      upCount,
      downCount,
    };
  });
}

function formatUptimeBucketRange(fromMs: number, toMs: number) {
  const from = new Date(fromMs);
  const to = new Date(toMs);
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate();
  if (sameDay) {
    const dayPart = from.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const fromT = from.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const toT = to.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${dayPart} ${fromT} – ${toT}`;
  }
  return `${formatAxisTime(from.toISOString())} – ${formatAxisTime(to.toISOString())}`;
}

const CHART_AVG_MAX_BUCKETS = 96;

/** Time-bucket averages over the series span; skips empty buckets. */
function buildAveragedChartSeries(
  chronological: ChartResultRow[],
  maxBuckets: number
): ChartResultRow[] {
  const n = chronological.length;
  if (n === 0) return [];

  if (n <= maxBuckets) {
    return chronological.map((r) => ({ ...r, bucketCheckCount: 1 }));
  }

  const times = chronological.map((r) => new Date(r.createdAt).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = Math.max(tMax - tMin, 1);
  const bucketCount = maxBuckets;

  const buckets: ChartResultRow[][] = Array.from({ length: bucketCount }, () => []);

  for (const r of chronological) {
    const t = new Date(r.createdAt).getTime();
    let idx = Math.floor(((t - tMin) / span) * bucketCount);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx]!.push(r);
  }

  const out: ChartResultRow[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const checks = buckets[i]!;
    if (checks.length === 0) continue;

    const fromMs = tMin + (span * i) / bucketCount;
    const toMs = tMin + (span * (i + 1)) / bucketCount;
    const midMs = (fromMs + toMs) / 2;

    const okTimes = checks
      .filter((c) => c.ok && c.responseTimeMs != null)
      .map((c) => c.responseTimeMs as number);
    const avgMs =
      okTimes.length > 0
        ? Math.round(okTimes.reduce((a, b) => a + b, 0) / okTimes.length)
        : null;
    const allOk = checks.every((c) => c.ok);

    out.push({
      id: `avg-bucket-${i}`,
      createdAt: new Date(midMs).toISOString(),
      ok: allOk,
      responseTimeMs: avgMs,
      bucketCheckCount: checks.length,
    });
  }
  return out;
}

// ─── tooltips ─────────────────────────────────────────────────────────────────

function ResponseTooltip({
  active,
  payload,
  label,
  labelUp,
  labelDown,
  labelResponse,
  labelBucketChecks,
}: TooltipProps<number, string> & {
  labelUp: string;
  labelDown: string;
  labelResponse: string;
  labelBucketChecks: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartResultRow;
  const ms = row.responseTimeMs;
  const bc = row.bucketCheckCount;
  const timeLabel = typeof label === "string" ? formatAxisTime(label) : String(label);
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-text-muted">{timeLabel}</p>
      {bc != null && bc > 1 && (
        <p className="mt-0.5 text-text-muted">{labelBucketChecks(bc)}</p>
      )}
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
  labelBucketChecks,
}: TooltipProps<number, string> & {
  labelUp: string;
  labelDown: string;
  labelResponse: string;
  labelBucketChecks: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as ScatterPoint;
  const bc = pt.bucketCheckCount;
  return (
    <div className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-text-muted">{pt.label}</p>
      {bc != null && bc > 1 && (
        <p className="mt-0.5 text-text-muted">{labelBucketChecks(bc)}</p>
      )}
      <p className={`mt-1 font-medium ${pt.ok ? "text-text-primary" : "text-destructive"}`}>
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
  detailMode = "averages",
}: {
  results: ChartResultRow[];
  baselineP75Ms?: number | null;
  degradationAlertEnabled?: boolean | null;
  detailMode?: ChartDetailMode;
}) {
  const t = useTranslations("monitorDetail");
  const gradientId = useId().replace(/:/g, "");

  if (results.length === 0) {
    return (
      <div className="mt-4 min-w-0 space-y-8">
        <div className="rounded-lg border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
          {t("chartNoData")}
        </div>
      </div>
    );
  }

  const chronological = [...results].reverse();
  const uptimeHourChronological = filterChronologicalLastHour(chronological);
  const uptimeStripSegments = buildUptimeStripSegments(uptimeHourChronological);
  const uptimeStripIsDense = uptimeHourChronological.length > UPTIME_STRIP_MAX_BUCKETS;
  const uptimeHourUp = uptimeHourChronological.filter((r) => r.ok).length;
  const uptimeHourDown = uptimeHourChronological.length - uptimeHourUp;

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
    "var(--color-chart-hist-warn)",
    "var(--color-destructive)",
  ];
  const hasHistData = histBuckets.some((b) => b.count > 0);

  const trendSeries: ChartResultRow[] =
    detailMode === "full"
      ? chronological
      : buildAveragedChartSeries(chronological, CHART_AVG_MAX_BUCKETS);

  // ── scatter points (same resolution as response trend) ─────────────────────
  const allScatterPoints: ScatterPoint[] = trendSeries.map((r) => ({
    x: new Date(r.createdAt).getTime(),
    y: r.ok && r.responseTimeMs != null ? r.responseTimeMs : 0,
    ok: r.ok,
    label: formatAxisTime(r.createdAt),
    ms: r.responseTimeMs,
    bucketCheckCount: r.bucketCheckCount,
  }));
  const scatterOk = allScatterPoints.filter((p) => p.ok && p.y > 0);
  const scatterFailed = allScatterPoints.filter((p) => !p.ok);

  // ── baseline comparison ───────────────────────────────────────────────────
  const recentOkTimes = chronological
    .slice(-DEGRADATION_RECENT_WINDOW)
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
        : ratio <= DEGRADATION_ENTER_RATIO
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400";

  return (
    <div className="mt-4 min-w-0 space-y-8">

      {/* ── 1. Uptime bar — last hour only (full range used for charts below) ─ */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("chartUptime")}
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">{t("chartUptimeLastHourOnly")}</p>
          </div>
          {uptimeHourChronological.length > 0 && uptimeStripIsDense && (
            <p className="text-[10px] text-text-muted">{t("chartUptimeGroupedHint")}</p>
          )}
        </div>
        {uptimeHourChronological.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-border-muted bg-bg-page px-3 py-4 text-center text-xs text-text-muted">
            {t("chartUptimeEmptyHour")}
          </div>
        ) : (
          <>
            <UptimeTooltipProvider delayDuration={0} skipDelayDuration={0}>
              <div
                className={`mt-2 w-full min-w-0 overflow-hidden ${
                  uptimeStripIsDense
                    ? "rounded-md border border-border bg-bg-page/80 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
                    : "rounded-sm"
                }`}
                aria-label={`${uptimeHourUp} successful checks, ${uptimeHourDown} failed checks in the last hour`}
              >
                <div
                  className={`grid w-full min-w-0 ${uptimeStripIsDense ? "h-9 gap-0" : "h-8 gap-px"}`}
                  style={{
                    gridTemplateColumns: `repeat(${uptimeStripSegments.length}, minmax(0, 1fr))`,
                  }}
                >
                  {uptimeStripSegments.map((seg) => {
                    const rangeLabel = formatUptimeBucketRange(seg.fromMs, seg.toMs);
                    const tip =
                      seg.checkCount === 1
                        ? `${formatAxisTime(new Date(seg.fromMs).toISOString())} · ${seg.ok ? t("statusBadgeUp") : t("statusBadgeDown")}`
                        : !seg.hasData
                          ? ""
                          : seg.downCount === 0
                            ? t("chartUptimeStripTitleBucketOk", {
                                range: rangeLabel,
                                checks: seg.checkCount,
                              })
                            : seg.upCount === 0
                              ? t("chartUptimeStripTitleBucketAllDown", {
                                  range: rangeLabel,
                                  checks: seg.checkCount,
                                })
                              : t("chartUptimeStripTitleBucketMixed", {
                                  range: rangeLabel,
                                  checks: seg.checkCount,
                                  failures: seg.downCount,
                                  ups: seg.upCount,
                                });
                    const segmentTone = !seg.hasData
                      ? "bg-border"
                      : seg.downCount === 0
                        ? "bg-emerald-500 dark:bg-emerald-600"
                        : seg.upCount === 0
                          ? "bg-red-500 dark:bg-red-600"
                          : "bg-amber-500 dark:bg-amber-600";
                    const segmentClass = `block min-h-[8px] min-w-0 cursor-default transition-opacity hover:opacity-90 ${
                      uptimeStripIsDense ? "rounded-none first:rounded-l-sm last:rounded-r-sm" : "rounded-[1px]"
                    } ${segmentTone}`;
                    if (!tip) {
                      return (
                        <span key={seg.key} className={segmentClass} />
                      );
                    }
                    return (
                      <UptimeTooltipRoot key={seg.key} delayDuration={0}>
                        <UptimeTooltipTrigger asChild>
                          <span className={segmentClass} />
                        </UptimeTooltipTrigger>
                        <UptimeTooltipPortal>
                          <UptimeTooltipContent
                            side="top"
                            sideOffset={6}
                            className="z-50 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-border bg-bg-card px-3 py-2 text-xs text-text-primary shadow-md"
                          >
                            {tip}
                          </UptimeTooltipContent>
                        </UptimeTooltipPortal>
                      </UptimeTooltipRoot>
                    );
                  })}
                </div>
              </div>
            </UptimeTooltipProvider>
            <div className="mt-1 flex justify-between text-[10px] text-text-muted">
              <span>{t("chartUptimeAxisHourStart")}</span>
              <span>{t("chartUptimeAxisHourEnd")}</span>
            </div>
          </>
        )}
      </div>

      {/* ── 2. Response time trend ──────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {t("chartResponseTrend")}
        </p>
        <p className="mt-0.5 text-[10px] text-text-muted">
          {detailMode === "averages" ? t("chartResponseTrendSubAverages") : t("chartResponseTrendSubFull")}
        </p>
        <div className="mt-2 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendSeries}
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
                    labelBucketChecks={(n) => t("tooltipBucketChecks", { n })}
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
            {detailMode === "averages" ? t("chartTimelineSubAverages") : t("chartTimelineSubFull")}
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
                      labelBucketChecks={(n) => t("tooltipBucketChecks", { n })}
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
                  fill="var(--color-destructive)"
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
              {
                label: t("chartRecentAvg"),
                value: recentAvgMs as number,
                color:
                  ratio != null && ratio > 2
                    ? "var(--color-destructive)"
                    : ratio != null && ratio > 1
                      ? "var(--color-chart-hist-warn)"
                      : "var(--color-accent)",
              },
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
