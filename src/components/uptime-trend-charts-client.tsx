"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Percent, Timer, Zap } from "lucide-react";
import type { ChartDetailMode, ChartResultRow } from "@/components/uptime-trend-charts";

const UptimeTrendChartsInner = dynamic(
  () => import("@/components/uptime-trend-charts").then((m) => ({ default: m.UptimeTrendCharts })),
  {
    ssr: false,
    loading: () => <div className="mt-4 h-64 animate-pulse rounded-lg bg-border/50" />,
  }
);

type ChartRange = "24h" | "7d" | "1m";

function computeStats(rows: ChartResultRow[]) {
  if (rows.length === 0) {
    return {
      uptimePct: null as number | null,
      avgResponseTimeMs: null as number | null,
      latestResponseMs: null as number | null,
      incidentCount: 0,
    };
  }
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = sorted[0];
  const up = rows.filter((r) => r.ok).length;
  const uptimePct = Math.round((up / rows.length) * 100);
  const responseTimes = rows
    .map((r) => r.responseTimeMs)
    .filter((ms): ms is number => ms != null);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
  const incidentCount = rows.filter((r) => !r.ok).length;
  return {
    uptimePct,
    avgResponseTimeMs,
    latestResponseMs: latest?.responseTimeMs ?? null,
    incidentCount,
  };
}

export function MonitorDetailHistoryClient({
  monitorId,
  initialResults,
  hasSslCard,
  showStatsGrid,
  baselineP75Ms,
  degradationAlertEnabled,
  children,
  aboveCharts,
}: {
  monitorId: string;
  initialResults: ChartResultRow[];
  hasSslCard: boolean;
  showStatsGrid: boolean;
  baselineP75Ms?: number | null;
  degradationAlertEnabled?: boolean | null;
  /** SSL stat card (server-rendered); only shown when `showStatsGrid` */
  children?: ReactNode;
  /** Degradation callout + recent incidents (server-rendered), between stats and history */
  aboveCharts?: ReactNode;
}) {
  const t = useTranslations("monitorDetail");
  const [range, setRange] = useState<ChartRange>("24h");
  const [chartDetail, setChartDetail] = useState<ChartDetailMode>("averages");
  const [rangeResults, setRangeResults] = useState<ChartResultRow[]>(initialResults);
  const [isLoading, setIsLoading] = useState(true);

  const serverDataRevision =
    initialResults.length > 0 ? initialResults[0]!.id : `empty:${initialResults.length}`;

  useEffect(() => {
    const ac = new AbortController();

    fetch(`/api/monitors/${encodeURIComponent(monitorId)}/results?range=${range}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch chart results: ${res.status}`);
        const data = (await res.json()) as Array<{
          id: string;
          createdAt: string | Date;
          ok: boolean;
          responseTimeMs: number | null;
        }>;
        const normalized: ChartResultRow[] = data.map((r) => ({
          id: r.id,
          createdAt: new Date(r.createdAt).toISOString(),
          ok: r.ok,
          responseTimeMs: r.responseTimeMs,
        }));
        setRangeResults(normalized);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => ac.abort();
  }, [monitorId, range, serverDataRevision]);

  const { uptimePct, avgResponseTimeMs, latestResponseMs, incidentCount } = useMemo(
    () => computeStats(rangeResults),
    [rangeResults]
  );

  const rangeOptions = useMemo(
    () =>
      [
        { id: "24h" as const, label: t("chartRange24h") },
        { id: "7d" as const, label: t("chartRange7d") },
        { id: "1m" as const, label: t("chartRange1m") },
      ] satisfies ReadonlyArray<{ id: ChartRange; label: string }>,
    [t]
  );

  const detailOptions = useMemo(
    () =>
      [
        { id: "averages" as const, label: t("chartDetailAverages") },
        { id: "full" as const, label: t("chartDetailFull") },
      ] satisfies ReadonlyArray<{ id: ChartDetailMode; label: string }>,
    [t]
  );

  const statTile =
    "flex min-w-0 flex-col rounded-xl border border-border/60 bg-bg-page/50 px-3 py-3 sm:px-4 sm:py-4";
  const statLabel =
    "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted";

  return (
    <div className="space-y-6">
      {showStatsGrid && (
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm">
        <div className="border-b border-border/60 px-5 py-3.5">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest text-text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("statsHeading")}
          </p>
        </div>
        <div
          className={`grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5 ${hasSslCard ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}
        >
        <div className={statTile}>
          <span className={statLabel}>
            <Percent className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {t("statUptime")}
          </span>
          <p
            className={`mt-2.5 text-2xl font-semibold tabular-nums sm:text-3xl ${
              uptimePct === null
                ? "text-text-muted"
                : uptimePct === 100
                  ? "text-status-up"
                  : uptimePct >= 90
                    ? "text-status-warn"
                    : "text-status-down"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {uptimePct != null ? `${uptimePct}%` : "—"}
          </p>
          <p className="mt-1.5 text-xs text-text-muted/70">
            {t("statChecks", { n: rangeResults.length })}
          </p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <Timer className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {t("statAvgResponse")}
          </span>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums text-text-primary sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {avgResponseTimeMs != null ? `${avgResponseTimeMs}ms` : "—"}
          </p>
          <p className="mt-1.5 text-xs text-text-muted/70">{t("statInSelectedRange")}</p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <Zap className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {t("statLatestResponse")}
          </span>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums text-text-primary sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {latestResponseMs != null ? `${latestResponseMs}ms` : "—"}
          </p>
          <p className="mt-1.5 text-xs text-text-muted/70">{t("statMostRecentInRange")}</p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <AlertTriangle className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {t("statIncidents")}
          </span>
          <p
            className={`mt-2.5 text-2xl font-semibold tabular-nums sm:text-3xl ${
              incidentCount > 0 ? "text-status-down" : "text-status-up"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {incidentCount > 0 ? incidentCount : t("statNone")}
          </p>
          <p className="mt-1.5 text-xs text-text-muted/70">{t("statInSelectedRange")}</p>
        </div>

        {children}
        </div>
      </div>
      )}

      {aboveCharts ? (
        <div className="space-y-6">{aboveCharts}</div>
      ) : null}

      <section
        className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm"
        aria-label={t("historyTitle")}
      >
        <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              className="text-[11px] font-semibold uppercase tracking-widest text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("historyTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("historySubtitle")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {t("chartRangeLabel")}
              </span>
              <div className="inline-flex rounded-lg border border-border/60 bg-bg-page p-0.5">
                {rangeOptions.map((opt) => {
                  const active = range === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (opt.id !== range) {
                          setIsLoading(true);
                          setRange(opt.id);
                        }
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-bg-card text-text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isLoading && (
                <span className="text-xs text-text-muted">{t("chartLoading")}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {t("chartDetailLabel")}
              </span>
              <div className="inline-flex rounded-lg border border-border/60 bg-bg-page p-0.5">
                {detailOptions.map((opt) => {
                  const active = chartDetail === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChartDetail(opt.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-bg-card text-text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
        <UptimeTrendChartsInner
          results={rangeResults}
          baselineP75Ms={baselineP75Ms}
          degradationAlertEnabled={degradationAlertEnabled}
          detailMode={chartDetail}
        />
        </div>
      </section>
    </div>
  );
}
