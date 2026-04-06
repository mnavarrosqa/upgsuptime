"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
            <li className="col-span-full mt-1">
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
            <li className="col-span-full mt-1">
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

      {/* Subtitle: inline stats or onboarding hint */}
      {hasMonitors ? (
        <p className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
          <span>{t("monitorCount", { count: monitors.length })}</span>
          <span aria-hidden>·</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {t("upCount", { count: upCount })}
          </span>
          {downCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="text-red-600 dark:text-red-400">
                {t("downLabel", { count: downCount })}
              </span>
            </>
          )}
          {username && (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/status/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text-primary"
              >
                {t("statusPageLink")}
              </Link>
            </>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-text-muted">
          {t("addFirstMonitor")}
        </p>
      )}

      {/* Toolbar: search + sort + add button */}
      <div className="mt-5 flex items-center gap-3 [--enter-delay:90ms] motion-safe:motion-soft-pop">
        {hasMonitors && (
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-nowrap">
            <div className="flex-1">
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
        )}
        <DashboardAddMonitor />
      </div>

      {/* Monitor grid / empty states */}
      {!hasMonitors ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">
            {t("noMonitorsYet")}
          </p>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">{t("noSearchMatch")}</p>
          <Button
            type="button"
            variant="link"
            onClick={() => setSearchQuery("")}
            className="mt-3 h-auto p-0 text-sm font-medium text-text-primary underline-offset-2 hover:text-text-muted"
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
