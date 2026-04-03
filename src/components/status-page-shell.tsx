"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatRelativeTime, formatDuration } from "@/lib/format-time";

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

type MonitorStat = {
  id: string;
  name: string;
  url: string;
  currentStatus: boolean | null;
  lastCheckAt: string | null;
  lastStatusChangedAt: string | null;
  uptimePct: number | null;
  checkCount90d: number;
  buckets: { ok: number; total: number }[];
  avgResponseTimeMs: number | null;
  lastErrorMessage: string | null;
  lastErrorCode: number | null;
};

export function StatusPageShell({
  username,
  monitors,
  downCount,
  incidents,
  generatedAt,
}: {
  username: string;
  monitors: MonitorStat[];
  downCount: number;
  incidents: MonitorStat[];
  generatedAt: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);

  const allOperational = downCount === 0 && monitors.length > 0;
  const hasMonitors = monitors.length > 0;

  // Overall stats (client-side aggregation)
  const totalChecks = monitors.reduce((s, m) => s + m.checkCount90d, 0);
  const uptimePcts = monitors
    .filter((m) => m.uptimePct !== null)
    .map((m) => m.uptimePct!);
  const avgUptime =
    uptimePcts.length > 0
      ? (uptimePcts.reduce((a, b) => a + b, 0) / uptimePcts.length).toFixed(1)
      : null;
  const responseTimes = monitors
    .filter((m) => m.avgResponseTimeMs !== null)
    .map((m) => m.avgResponseTimeMs!);
  const avgResponse =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Pulsing status dot */}
              {hasMonitors && (
                <span className="relative flex h-3 w-3 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      allOperational ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-3 w-3 rounded-full ${
                      allOperational ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                </span>
              )}
              <div>
                <p
                  className="text-base font-semibold text-text-primary"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {username}
                </p>
                <p className="text-xs text-text-muted">
                  {hasMonitors
                    ? `${monitors.length} service${monitors.length !== 1 ? "s" : ""} monitored`
                    : "Status page"}
                </p>
              </div>
            </div>
            <span className="text-xs text-text-muted">
              Updated {formatRelativeTime(generatedAt)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* ── Status hero ─────────────────────────────────────────── */}
        {hasMonitors ? (
          <div
            className={`rounded-xl px-6 py-5 ${
              allOperational
                ? "bg-emerald-50 dark:bg-emerald-900/10"
                : "bg-red-50 dark:bg-red-900/10"
            }`}
          >
            <div className="flex items-center gap-3">
              {allOperational ? (
                <CheckCircle
                  className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              ) : (
                <XCircle
                  className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400"
                  aria-hidden
                />
              )}
              <p
                className={`text-lg font-semibold ${
                  allOperational
                    ? "text-emerald-800 dark:text-emerald-300"
                    : "text-red-800 dark:text-red-300"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {allOperational
                  ? "All Systems Operational"
                  : `${downCount} system${downCount !== 1 ? "s" : ""} having issues`}
              </p>
            </div>

            {/* Stats row */}
            {(avgUptime !== null || avgResponse !== null || totalChecks > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                {avgUptime !== null && (
                  <span>
                    <span
                      className={
                        parseFloat(avgUptime) >= 99.5
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : parseFloat(avgUptime) >= 95
                            ? "font-medium text-yellow-700 dark:text-yellow-400"
                            : "font-medium text-red-700 dark:text-red-400"
                      }
                    >
                      {avgUptime}%
                    </span>{" "}
                    avg uptime
                  </span>
                )}
                {avgUptime !== null && (avgResponse !== null || totalChecks > 0) && (
                  <span aria-hidden className="text-border">·</span>
                )}
                {avgResponse !== null && (
                  <span>
                    <span className="font-medium text-text-primary">{avgResponse}ms</span>{" "}
                    avg response
                  </span>
                )}
                {avgResponse !== null && totalChecks > 0 && (
                  <span aria-hidden className="text-border">·</span>
                )}
                {totalChecks > 0 && (
                  <span>
                    <span className="font-medium text-text-primary">
                      {totalChecks.toLocaleString()}
                    </span>{" "}
                    checks in 90 days
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
            No public services configured.
          </div>
        )}

        {/* ── Services list ────────────────────────────────────────── */}
        {hasMonitors && (
          <section className="mt-6" aria-label="Services">
            <div className="flex flex-col gap-3">
              {monitors.map((m) => {
                const favicon = getFaviconUrl(m.url);
                const isUp = m.currentStatus === true;
                const isDown = m.currentStatus === false;
                const uptimeColor =
                  m.uptimePct === null
                    ? "text-text-muted"
                    : m.uptimePct >= 99.5
                      ? "text-emerald-600 dark:text-emerald-400"
                      : m.uptimePct >= 95
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400";

                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-border bg-bg-card px-4 py-3"
                  >
                    {/* Service header row */}
                    <div className="flex items-center gap-2.5">
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded"
                          width={20}
                          height={20}
                        />
                      ) : (
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-border text-xs text-text-muted"
                          aria-hidden
                        >
                          •
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-text-primary">
                            {m.name}
                          </span>

                          {/* Pulsing dot + status label */}
                          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                            {isUp ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Operational
                                </span>
                              </>
                            ) : isDown ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                                </span>
                                <span className="text-red-700 dark:text-red-400">
                                  Disrupted
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 rounded-full bg-border" />
                                <span className="text-text-muted">No data</span>
                              </>
                            )}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {m.url}
                        </p>
                      </div>
                    </div>

                    {/* 90-day uptime chart */}
                    {m.checkCount90d > 0 && (
                      <div className="mt-3">
                        <div
                          className="flex h-7 gap-px"
                          aria-label="90-day uptime history"
                          title="90-day uptime — each bar represents 3 days"
                        >
                          {m.buckets.map((b, i) => {
                            const pct = b.total > 0 ? b.ok / b.total : -1;
                            const color =
                              pct < 0
                                ? "var(--color-border)"
                                : pct >= 1
                                  ? "#10b981"
                                  : pct >= 0.9
                                    ? "#f59e0b"
                                    : "#ef4444";
                            return (
                              <span
                                key={i}
                                className="flex-1 rounded-sm transition-opacity hover:opacity-70"
                                style={{ minWidth: "4px", backgroundColor: color }}
                                title={
                                  pct < 0
                                    ? "No data"
                                    : `${Math.round(pct * 100)}% uptime`
                                }
                              />
                            );
                          })}
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                          <span>90 days ago</span>
                          <span>Today</span>
                        </div>
                      </div>
                    )}

                    {/* Footer stats row */}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-muted">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {m.uptimePct !== null && (
                          <span className={uptimeColor}>{m.uptimePct}% uptime</span>
                        )}
                        {m.uptimePct !== null && m.avgResponseTimeMs !== null && (
                          <span aria-hidden>·</span>
                        )}
                        {m.avgResponseTimeMs !== null && (
                          <span>{m.avgResponseTimeMs}ms avg</span>
                        )}
                        {(m.uptimePct !== null || m.avgResponseTimeMs !== null) &&
                          m.checkCount90d > 0 && (
                            <span aria-hidden>·</span>
                          )}
                        {m.checkCount90d > 0 && (
                          <span>{m.checkCount90d.toLocaleString()} checks</span>
                        )}
                      </div>
                      <span className="shrink-0">
                        Checked {formatRelativeTime(m.lastCheckAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Active incidents ─────────────────────────────────────── */}
        {incidents.length > 0 && (
          <section
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10"
            aria-label="Active incidents"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden
              />
              <h2 className="text-sm font-semibold text-red-800 dark:text-red-400">
                Active Incidents
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-red-700/60 dark:text-red-400/60">
              Services currently experiencing issues
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {incidents.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="font-medium truncate">{m.name}</span>
                    </div>
                    {(m.lastErrorCode != null || m.lastErrorMessage) && (
                      <p
                        className="mt-0.5 ml-5.5 truncate text-xs text-red-600/70 dark:text-red-400/60"
                        title={[
                          m.lastErrorCode != null ? `HTTP ${m.lastErrorCode}` : null,
                          m.lastErrorMessage,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {m.lastErrorCode != null ? `HTTP ${m.lastErrorCode}` : ""}
                        {m.lastErrorCode != null && m.lastErrorMessage ? " · " : ""}
                        {m.lastErrorMessage ?? ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-red-600/70 dark:text-red-400/60">
                    {m.lastStatusChangedAt
                      ? `Down for ${formatDuration(m.lastStatusChangedAt)}`
                      : "Down"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
          <span>Powered by UPG Monitor</span>
          <span aria-hidden>·</span>
          <span>Refreshes every 60s</span>
        </p>
      </main>
    </div>
  );
}
