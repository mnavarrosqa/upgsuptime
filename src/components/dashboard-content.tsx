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
import { CircleHelp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardContentProps = {
  monitors: Monitor[];
  latestByMonitor: Record<
    string,
    { ok: boolean; responseTimeMs: number | null; message: string | null }
  >;
  trendByMonitor: Record<string, TrendPoint[]>;
  uptimeByMonitor: Record<string, number | null>;
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
  uptimeByMonitor: Record<string, number | null>;
  sortBy: { field: string; direction: "asc" | "desc" };
};

const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wider text-text-muted";

function StatusLiveDot({ tone }: { tone: "up" | "down" | "paused" }) {
  return (
    <span
      className="relative mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center sm:mt-2"
      aria-hidden
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "up" && "bg-status-up animate-operational-badge-dot",
          tone === "down" && "bg-status-down",
          tone === "paused" && "bg-text-muted/70"
        )}
      />
    </span>
  );
}

function SectionHeading({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "down" | "up" | "muted";
}) {
  return (
    <li className="col-span-full mt-7 first:mt-0">
      <div className="flex items-center gap-3">
        <p
          className={cn(
            sectionLabelClass,
            tone === "down" && "text-status-down",
            tone === "up" && "text-status-up"
          )}
        >
          {children}
        </p>
        <span className="h-px min-w-6 flex-1 bg-border" aria-hidden />
      </div>
    </li>
  );
}

// Extracted outside MonitorGrid so it is not re-created on every render (Rule 5.4).
function MonitorGridCard({
  m,
  index,
  latestByMonitor,
  trendByMonitor,
  uptimeByMonitor,
}: {
  m: Monitor;
  index: number;
  latestByMonitor: MonitorGridProps["latestByMonitor"];
  trendByMonitor: MonitorGridProps["trendByMonitor"];
  uptimeByMonitor: MonitorGridProps["uptimeByMonitor"];
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
      uptimePct={uptimeByMonitor[m.id] ?? null}
      lastCheckAt={m.lastCheckAt}
      sslMonitoring={!!m.sslMonitoring}
      sslValid={m.sslValid ?? null}
      sslExpiresAt={m.sslExpiresAt ?? null}
      enterDelayMs={Math.min(index * 35, 260)}
      downtimeAcked={isDowntimeAcked(m)}
    />
  );
}

function MonitorGrid({ monitors, latestByMonitor, trendByMonitor, uptimeByMonitor, sortBy }: MonitorGridProps) {
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
    <ul className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr))]">
      {downMonitors.length > 0 && (
        <>
          {multipleGroups && (
            <SectionHeading tone="down">{t("sectionIssues", { count: downMonitors.length })}</SectionHeading>
          )}
          {downMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} uptimeByMonitor={uptimeByMonitor} />
          ))}
        </>
      )}
      {pausedMonitors.length > 0 && (
        <>
          {multipleGroups && (
            <SectionHeading>{t("sectionPaused", { count: pausedMonitors.length })}</SectionHeading>
          )}
          {pausedMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} uptimeByMonitor={uptimeByMonitor} />
          ))}
        </>
      )}
      {(upMonitors.length > 0 || uncheckedMonitors.length > 0) && (
        <>
          {multipleGroups && (
            <SectionHeading tone="up">
              {t("sectionOperational", { count: upMonitors.length + uncheckedMonitors.length })}
            </SectionHeading>
          )}
          {upMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} uptimeByMonitor={uptimeByMonitor} />
          ))}
          {uncheckedMonitors.map((m, index) => (
            <MonitorGridCard key={m.id} m={m} index={index + upMonitors.length} latestByMonitor={latestByMonitor} trendByMonitor={trendByMonitor} uptimeByMonitor={uptimeByMonitor} />
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
  uptimeByMonitor,
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

  const { downCount, pausedCount, hasMonitors, allPaused, locationLabel } = useMemo(() => {
    const paused = monitors.filter((m) => m.paused).length;
    const down = monitors.filter((m) => {
      const latest = latestByMonitor[m.id];
      return !m.paused && latest && !latest.ok;
    }).length;
    const has = monitors.length > 0;
    return {
      downCount: down,
      pausedCount: paused,
      hasMonitors: has,
      allPaused: has && paused === monitors.length,
      locationLabel: checkLocation ?? t("statValueLocationUnknown"),
    };
  }, [monitors, latestByMonitor, checkLocation, t]);

  const statusTone = downCount > 0 ? "down" : allPaused ? "paused" : "up";
  const statusLabel = downCount > 0
    ? t("downCount", { count: downCount })
    : allPaused
      ? t("allPaused")
      : t("allOperational");

  return (
    <>
      <div className="motion-safe:motion-enter">
        <AutoRefresh />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {hasMonitors ? (
            <>
              <h1
                className={cn(
                  "flex items-start gap-2.5 font-display text-[clamp(1.65rem,3.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight",
                  downCount > 0 ? "text-status-down" : "text-text-primary"
                )}
                aria-live="polite"
              >
                <StatusLiveDot tone={statusTone} />
                <span>{statusLabel}</span>
              </h1>
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                <span className="tabular-nums">{t("monitorCount", { count: monitors.length })}</span>
                {pausedCount > 0 && !allPaused ? (
                  <>
                    <span className="text-border-muted select-none" aria-hidden>
                      ·
                    </span>
                    <span className="tabular-nums">{t("pausedCountMeta", { count: pausedCount })}</span>
                  </>
                ) : null}
                <span className="text-border-muted select-none" aria-hidden>
                  ·
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span className="truncate">{t("checksFrom", { location: locationLabel })}</span>
                  <TooltipProvider delayDuration={140}>
                    <TooltipRoot>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-7 items-center justify-center rounded-md text-text-muted/90 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          aria-label={t("statLocationTooltip")}
                        >
                          <CircleHelp className="size-3.5 shrink-0" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="z-50 max-w-[20rem] rounded-md border border-border bg-bg-card px-2.5 py-2 text-[11px] font-medium text-text-primary shadow-md"
                        >
                          {t("statLocationTooltip")}
                        </TooltipContent>
                      </TooltipPortal>
                    </TooltipRoot>
                  </TooltipProvider>
                </span>
                {username ? (
                  <>
                    <span className="text-border-muted select-none" aria-hidden>
                      ·
                    </span>
                    <Link
                      href={`/status/${username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-text-primary underline-offset-4 transition-colors hover:text-text-muted hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t("statusPageLink")}
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </Link>
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-[clamp(1.65rem,3.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight text-text-primary">
                {t("emptyTitle")}
              </h1>
              <p className="mt-2.5 max-w-md text-sm text-text-muted">{t("emptyBody")}</p>
            </>
          )}
        </div>
        <div className="shrink-0 sm:pt-1">
          <DashboardAddMonitor />
        </div>
      </div>

      {hasMonitors && (
        <div className="mt-6 flex flex-col gap-2.5 border-b border-border pb-4 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <SearchWithTypeahead
              monitors={searchItems}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <div className="shrink-0">
            <SortDropdown
              options={sortOptions}
              value={sortBy.field}
              direction={sortBy.direction}
              onChange={(field, direction) => setSortBy({ field, direction })}
            />
          </div>
        </div>
      )}

      {!hasMonitors ? null : filteredMonitors.length === 0 ? (
        <div className="mt-10 max-w-md">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary">
            {t("noSearchTitle")}
          </h2>
          <p className="mt-1.5 text-sm text-text-muted">{t("noSearchMatch")}</p>
          <Button
            type="button"
            variant="link"
            onClick={() => setSearchQuery("")}
            className="mt-3 h-auto p-0 text-sm font-medium text-primary underline-offset-4 hover:text-primary/80"
          >
            {t("clearSearch")}
          </Button>
        </div>
      ) : (
        <MonitorGrid
          monitors={filteredMonitors}
          latestByMonitor={latestByMonitor}
          trendByMonitor={trendByMonitor}
          uptimeByMonitor={uptimeByMonitor}
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
