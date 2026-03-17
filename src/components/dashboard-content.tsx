"use client";

import { useState } from "react";
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
import Link from "next/link";

type DashboardContentProps = {
  monitors: Monitor[];
  latestByMonitor: Record<
    string,
    { ok: boolean; responseTimeMs: number | null }
  >;
  trendByMonitor: Record<string, TrendPoint[]>;
  username: string | null;
};

export function DashboardContent({
  monitors,
  latestByMonitor,
  trendByMonitor,
  username,
}: DashboardContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchItems: MonitorSearchItem[] = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    url: m.url,
  }));
  const filteredMonitors = filterMonitorsBySearch(monitors, searchQuery);

  const upCount = monitors.filter((m) => latestByMonitor[m.id]?.ok === true).length;
  const downCount = monitors.filter((m) => {
    const latest = latestByMonitor[m.id];
    return latest && !latest.ok;
  }).length;
  const hasMonitors = monitors.length > 0;
  const allUp = downCount === 0 && hasMonitors;

  return (
    <div>
      <AutoRefresh />
      {/* Header: title + status badge */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dashboard
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
              className="h-1.5 w-1.5 rounded-full bg-white/80 dark:bg-current"
              aria-hidden
            />
            {allUp ? "All systems operational" : `${downCount} down`}
          </span>
        )}
      </div>

      {/* Subtitle: inline stats or onboarding hint */}
      {hasMonitors ? (
        <p className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
          <span>
            {monitors.length} monitor{monitors.length !== 1 ? "s" : ""}
          </span>
          <span aria-hidden>·</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {upCount} up
          </span>
          {downCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="text-red-600 dark:text-red-400">
                {downCount} down
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
                Status page →
              </Link>
            </>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-text-muted">
          Add your first monitor to get started.
        </p>
      )}

      {/* Toolbar: search + add button */}
      <div className="mt-5 flex items-center gap-3">
        {hasMonitors && (
          <div className="flex-1">
            <SearchWithTypeahead
              monitors={searchItems}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name or URL…"
            />
          </div>
        )}
        <DashboardAddMonitor />
      </div>

      {/* Monitor grid / empty states */}
      {!hasMonitors ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">
            No monitors yet. Add one above to get started.
          </p>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">No monitors match your search.</p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-3 inline-block text-sm font-medium text-text-primary hover:text-text-muted"
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMonitors.map((m) => (
            <MonitorCard
              key={m.id}
              id={m.id}
              name={m.name}
              url={m.url}
              latest={latestByMonitor[m.id]}
              trendResults={trendByMonitor[m.id] ?? []}
              lastCheckAt={m.lastCheckAt}
              sslMonitoring={!!m.sslMonitoring}
              sslValid={m.sslValid ?? null}
              sslExpiresAt={m.sslExpiresAt ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
