"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Provider as TooltipProvider,
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
  Portal as TooltipPortal,
  Content as TooltipContent,
} from "@radix-ui/react-tooltip";
import type { Monitor } from "@/db/schema";
import { MonitorCard } from "@/components/monitor-card";
import {
  SearchWithTypeahead,
  filterMonitorsBySearch,
  type MonitorSearchItem,
} from "@/components/search-with-typeahead";
import type { TrendPoint } from "@/components/monitor-card-trend";
import { DashboardAddMonitor } from "@/components/dashboard-add-monitor";
import { AutoRefresh } from "@/components/auto-refresh";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { SortDropdown } from "@/components/sort-dropdown";
import { sortMonitors } from "@/lib/sort-monitors";
import { isDowntimeAcked } from "@/lib/downtime-ack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, CheckCircle2, CircleHelp, ExternalLink, Layers, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardContentProps = {
  monitors: Monitor[];
  latestByMonitor: Record<
    string,
    { ok: boolean; responseTimeMs: number | null; message: string | null }
  >;
  trendByMonitor: Record<string, TrendPoint[]>;
  username: string | null;
  onboarding?: {
    onboardingCompleted?: boolean | null;
    onboardingStep?: string | null;
  };
  userId: string;
  checkLocation: string | null;
};

type MonitorGridProps = {
  monitors: Monitor[];
  latestByMonitor: Record<string, { ok: boolean; responseTimeMs: number | null; message: string | null }>;
  trendByMonitor: Record<string, TrendPoint[]>;
  sortBy: { field: string; direction: "asc" | "desc" };
};

// Extracted outside MonitorGrid so it is not re-created on every render (Rule 5.4).
function MonitorGridCard({
  m,
  index,
  latestByMonitor,
  trendByMonitor,
}: {
  m: Monitor;
  index: number;
  latestByMonitor: MonitorGridProps["latestByMonitor"];
  trendByMonitor: MonitorGridProps["trendByMonitor"];
}) {
  return (
    <MonitorCard
      key={m.id}
      id={m.id}
      name={m.name}
      url={m.url}
      monitorType={m.type ?? "http"}
      paused={m.paused}
      latest={latestByMonitor[m.id]}
      trendResults={trendByMonitor[m.id] ?? []}
      lastCheckAt={m.lastCheckAt}
      sslMonitoring={!!m.sslMonitoring}
      sslValid={m.sslValid ?? null}
      sslExpiresAt={m.sslExpiresAt ?? null}
      enterDelayMs={Math.min(index * 35, 260)}
      downtimeAcked={isDowntimeAcked(m)}
    />
  );
}

function MonitorGrid({ monitors, latestByMonitor, trendByMonitor, sortBy }: MonitorGridProps) {
  const t = useTranslations("dashboard");
  const downMonitors = sortMonitors(
    monitors.filter((m) => !m.paused && latestByMonitor[m.id] && !latestByMonitor[m.id].ok),
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );
  const pausedMonitors = sortMonitors(
    monitors.filter((m) => m.paused),
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );
  const upMonitors = sortMonitors(
    monitors.filter((m) => !m.paused && latestByMonitor[m.id]?.ok === true),
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );
  const uncheckedMonitors = sortMonitors(
    monitors.filter((m) => !m.paused && !latestByMonitor[m.id]),
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );

  const multipleGroups =
    [downMonitors, pausedMonitors, [...upMonitors, ...uncheckedMonitors]].filter((g) => g.length > 0).length > 1;

  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {downMonitors.length > 0 && (
        <>
          {multipleGroups && (
            <li className="col-span-full">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
                {t("issues")}
              </p>
            </li>
          )}
          {downMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} />
          ))}
        </>
      )}
      {pausedMonitors.length > 0 && (
        <>
          {multipleGroups && (
            <li className="col-span-full mt-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                {t("paused")}
              </p>
            </li>
          )}
          {pausedMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} />
          ))}
        </>
      )}
      {(upMonitors.length > 0 || uncheckedMonitors.length > 0) && (
        <>
          {multipleGroups && (
            <li className="col-span-full mt-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {t("operational")}
              </p>
            </li>
          )}
          {upMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} />
          ))}
          {uncheckedMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index + upMonitors.length} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} />
          ))}
        </>
      )}
    </ul>
  );
}

export function DashboardContent({
  monitors,
  latestByMonitor,
  trendByMonitor,
  username,
  onboarding,
  userId,
  checkLocation,
}: DashboardContentProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tSort = useTranslations("sort");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<{ field: string; direction: "asc" | "desc" }>({
    field: "name",
    direction: "asc",
  });
  const [showOnboarding, setShowOnboarding] = useState(
    !onboarding?.onboardingCompleted && monitors.length === 0
  );

  // Memoize derived collections so they are not recomputed on every render
  // (e.g. sort state or onboarding state changes) — Rule 5.1.
  const searchItems: MonitorSearchItem[] = useMemo(
    () => monitors.map((m) => ({ id: m.id, name: m.name, url: m.url })),
    [monitors]
  );
  const filteredMonitors = useMemo(
    () => filterMonitorsBySearch(monitors, searchQuery),
    [monitors, searchQuery]
  );

  const sortOptions = useMemo(
    () => [
      { value: "name", label: tSort("name") },
      { value: "lastCheckAt", label: tSort("lastCheckAt") },
      { value: "createdAt", label: tSort("createdAt") },
      { value: "responseTime", label: tSort("responseTime") },
      { value: "intervalMinutes", label: tSort("intervalMinutes") },
    ],
    [tSort]
  );

  const upCount = monitors.filter((m) => latestByMonitor[m.id]?.ok === true).length;
  const downCount = monitors.filter((m) => {
    const latest = latestByMonitor[m.id];
    return latest && !latest.ok;
  }).length;
  const hasMonitors = monitors.length > 0;
  const allUp = downCount === 0 && hasMonitors;

  return (
    <>
      <div className="motion-safe:motion-enter">
        <AutoRefresh />
      {/* Header: title + status badge */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("title")}
        </h1>
        {hasMonitors && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              allUp
                ? "bg-emerald-600 text-white dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-600 text-white dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            <span
              className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center"
              aria-hidden
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full bg-white/80 dark:bg-current",
                  allUp && "animate-operational-badge-dot"
                )}
              />
            </span>
            {allUp ? t("allOperational") : t("downCount", { count: downCount })}
          </span>
        )}
      </div>

      {/* Summary strip + toolbar (when monitors exist) */}
      {hasMonitors && (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <div className="border-b border-border/80 bg-gradient-to-b from-muted/40 to-transparent px-2.5 py-2 dark:from-muted/25 sm:px-3 sm:py-2">
              <p
                className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("summaryHeading")}
              </p>
            </div>
            <div className="p-2.5 sm:p-3">
              <div
                className={cn(
                  "flex flex-col gap-3",
                  username ? "sm:flex-row sm:items-stretch sm:gap-4" : ""
                )}
              >
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  <div className="flex min-w-0 flex-col rounded-lg border border-border/80 bg-muted/35 px-2 py-2 dark:bg-muted/20 sm:px-2.5 sm:py-2.5">
                    <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
                      <Layers className="size-3 shrink-0 opacity-80" aria-hidden />
                      {t("statLabelTotal")}
                    </span>
                    <p
                      className="mt-1.5 truncate text-lg font-semibold tabular-nums text-text-primary sm:text-xl"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {monitors.length}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col rounded-lg border border-border/80 bg-emerald-500/[0.06] px-2 py-2 dark:bg-emerald-500/10 sm:px-2.5 sm:py-2.5">
                    <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/90">
                      <CheckCircle2 className="size-3 shrink-0 opacity-90" aria-hidden />
                      {t("statLabelUp")}
                    </span>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-xl">
                      {upCount}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex min-w-0 flex-col rounded-lg border px-2 py-2 sm:px-2.5 sm:py-2.5",
                      downCount > 0
                        ? "border-red-500/35 bg-red-500/[0.06] dark:bg-red-500/10"
                        : "border-border/80 bg-muted/35 dark:bg-muted/20"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider",
                        downCount > 0
                          ? "text-red-700 dark:text-red-400/90"
                          : "text-text-muted"
                      )}
                    >
                      <XCircle className="size-3 shrink-0 opacity-90" aria-hidden />
                      {t("statLabelDown")}
                    </span>
                    <p
                      className={cn(
                        "mt-1.5 text-lg font-semibold tabular-nums sm:text-xl",
                        downCount > 0
                          ? "text-red-700 dark:text-red-400"
                          : "text-text-muted"
                      )}
                    >
                      {downCount}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col rounded-lg border border-border/80 bg-muted/35 px-2 py-2 dark:bg-muted/20 sm:px-2.5 sm:py-2.5">
                    <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
                      <MapPin className="size-3 shrink-0 opacity-80" aria-hidden />
                      {t("statLabelLocation")}
                      <TooltipProvider delayDuration={140}>
                        <TooltipRoot>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center text-text-muted/90 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
                              aria-label={t("statLocationTooltip")}
                            >
                              <CircleHelp className="size-3 shrink-0" aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipPortal>
                            <TooltipContent
                              side="top"
                              sideOffset={6}
                              className="z-50 max-w-[20rem] rounded-md border border-border bg-bg-card px-2.5 py-2 text-[11px] font-medium normal-case tracking-normal text-text-primary shadow-md"
                            >
                              {t("statLocationTooltip")}
                            </TooltipContent>
                          </TooltipPortal>
                        </TooltipRoot>
                      </TooltipProvider>
                    </span>
                    <p className="mt-1.5 truncate text-sm font-medium text-text-primary sm:text-base">
                      {checkLocation ?? t("statValueLocationUnknown")}
                    </p>
                  </div>
                </div>
                {username ? (
                  <>
                    <div
                      className="hidden w-px shrink-0 bg-border sm:block"
                      aria-hidden
                    />
                    <div className="flex items-center justify-center sm:w-[min(100%,13rem)] sm:shrink-0 sm:flex-col sm:justify-center">
                      <Link
                        href={`/status/${username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full max-w-sm items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated/80 px-2.5 py-2 text-center text-xs font-medium text-text-primary transition-[background-color,box-shadow,color] hover:bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto sm:min-w-[10rem] sm:text-sm"
                      >
                        <ExternalLink
                          className="size-3.5 shrink-0 text-text-muted sm:size-4"
                          aria-hidden
                        />
                        {t("statusPageLink")}
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-bg-card p-3 sm:p-4 [--enter-delay:90ms] motion-safe:motion-soft-pop">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <SearchWithTypeahead
                    monitors={searchItems}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={t("searchPlaceholder")}
                  />
                </div>
                <SortDropdown
                  options={sortOptions}
                  value={sortBy.field}
                  direction={sortBy.direction}
                  onChange={(field, direction) => setSortBy({ field, direction })}
                />
              </div>
              <div className="flex shrink-0 justify-end sm:justify-start">
                <DashboardAddMonitor />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Monitor grid / empty states */}
      {!hasMonitors ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-muted bg-bg-card/50 p-8 text-center sm:p-12">
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
              <Activity className="size-6" aria-hidden />
            </span>
            <h2
              className="mt-4 text-lg font-semibold tracking-tight text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("emptyTitle")}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{t("emptyBody")}</p>
            <div className="mt-6">
              <DashboardAddMonitor />
            </div>
          </div>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-muted bg-bg-card/50 p-8 text-center sm:p-12">
          <h2
            className="text-lg font-semibold tracking-tight text-text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("noSearchTitle")}
          </h2>
          <p className="mt-2 text-sm text-text-muted">{t("noSearchMatch")}</p>
          <Button
            type="button"
            variant="link"
            onClick={() => setSearchQuery("")}
            className="mt-4 h-auto p-0 text-sm font-medium text-primary underline-offset-4 hover:text-primary/80"
          >
            {t("clearSearch")}
          </Button>
        </div>
      ) : (
        <MonitorGrid
          monitors={filteredMonitors}
          latestByMonitor={latestByMonitor}
          trendByMonitor={trendByMonitor}
          sortBy={sortBy}
        />
      )}

      <OnboardingOverlay
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        userId={userId}
        currentStep={onboarding?.onboardingStep as "welcome" | "add-monitor" | "alerts" | "status-page" | "complete" | null}
        username={username}
        onComplete={() => {
          setShowOnboarding(false);
          router.refresh();
        }}
      />
      </div>
    </>
  );
}
