"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Percent, Timer, Zap } from "lucide-react";
import type { ChartResultRow } from "@/components/uptime-trend-charts";

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
  const [rangeResults, setRangeResults] = useState<ChartResultRow[]>(initialResults);
  const [isLoading, setIsLoading] = useState(true);

  /** Bumps when RSC refreshes with new check rows (e.g. after "Check now" or scheduled run). */
  const serverDataRevision =
    initialResults.length > 0 ? initialResults[0]!.id : `empty:${initialResults.length}`;

  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);

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

  const statTile =
    "flex min-w-0 flex-col rounded-xl border border-border/80 bg-muted/35 px-2.5 py-3 dark:bg-muted/20 sm:px-3 sm:py-3.5";
  const statLabel =
    "flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted";

  return (
    <div className="space-y-8">
      {showStatsGrid && (
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="border-b border-border/80 bg-gradient-to-b from-muted/40 to-transparent px-4 py-2.5 dark:from-muted/25 sm:px-5 sm:py-3">
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("statsHeading")}
          </p>
        </div>
        <div
          className={`grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4 ${hasSslCard ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}
        >
        <div className={statTile}>
          <span className={statLabel}>
            <Percent className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("statUptime")}
          </span>
          <p
            className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${
              uptimePct === null
                ? "text-text-muted"
                : uptimePct === 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : uptimePct >= 90
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {uptimePct != null ? `${uptimePct}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {t("statChecks", { n: rangeResults.length })}
          </p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <Timer className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("statAvgResponse")}
          </span>
          <p className="mt-2 text-xl font-semibold tabular-nums text-text-primary sm:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {avgResponseTimeMs != null ? `${avgResponseTimeMs}ms` : "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("statInSelectedRange")}</p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <Zap className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("statLatestResponse")}
          </span>
          <p className="mt-2 text-xl font-semibold tabular-nums text-text-primary sm:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {latestResponseMs != null ? `${latestResponseMs}ms` : "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("statMostRecentInRange")}</p>
        </div>

        <div className={statTile}>
          <span className={statLabel}>
            <AlertTriangle className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("statIncidents")}
          </span>
          <p
            className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${
              incidentCount > 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {incidentCount > 0 ? incidentCount : t("statNone")}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("statInSelectedRange")}</p>
        </div>

        {children}
        </div>
      </div>
      )}

      {aboveCharts ? (
        <div className="space-y-8">{aboveCharts}</div>
      ) : null}

      <section
        className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        aria-label={t("historyTitle")}
      >
        <div className="flex flex-col gap-4 border-b border-border/80 bg-gradient-to-b from-muted/35 to-transparent px-4 py-3 dark:from-muted/20 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2
              className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("historyTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("historySubtitle")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("chartRangeLabel")}
            </span>
            <div className="inline-flex rounded-lg border border-border bg-bg-page p-0.5">
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
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
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
        </div>

        <div className="p-4 sm:p-5 md:p-6">
        <UptimeTrendChartsInner
          results={rangeResults}
          baselineP75Ms={baselineP75Ms}
          degradationAlertEnabled={degradationAlertEnabled}
        />
        </div>
      </section>
    </div>
  );
}
