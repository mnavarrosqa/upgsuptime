"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Minus } from "lucide-react";

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
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

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-base font-semibold text-text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {username}
              </p>
              <p className="text-xs text-text-muted">Status page</p>
            </div>
            <span className="text-xs text-text-muted">
              Updated {formatRelativeTime(generatedAt)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {hasMonitors ? (
          <div
            className={`flex items-center gap-3 rounded-lg px-5 py-4 ${
              allOperational
                ? "bg-emerald-50 dark:bg-emerald-900/10"
                : "bg-red-50 dark:bg-red-900/10"
            }`}
          >
            {allOperational ? (
              <CheckCircle
                className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            ) : (
              <XCircle
                className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden
              />
            )}
            <div>
              <p
                className={`font-semibold ${
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
              <p className="mt-0.5 text-xs text-text-muted">
                {monitors.length} service{monitors.length !== 1 ? "s" : ""} monitored
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
            No public services configured.
          </div>
        )}

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
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isUp
                                ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                                : isDown
                                  ? "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                                  : "bg-border text-text-muted"
                            }`}
                          >
                            {isUp ? (
                              <CheckCircle className="h-3 w-3" aria-hidden />
                            ) : isDown ? (
                              <XCircle className="h-3 w-3" aria-hidden />
                            ) : (
                              <Minus className="h-3 w-3" aria-hidden />
                            )}
                            {isUp ? "Operational" : isDown ? "Disrupted" : "No data"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {m.url}
                        </p>
                      </div>
                    </div>

                    {m.checkCount90d > 0 && (
                      <div className="mt-3">
                        <div
                          className="flex h-5 gap-px"
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
                                className="flex-1 rounded-[1px]"
                                style={{ minWidth: "4px", backgroundColor: color }}
                                title={
                                  pct < 0 ? "No data" : `${Math.round(pct * 100)}%`
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

                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-muted">
                      <div className="flex items-center gap-2">
                        {m.uptimePct !== null && (
                          <span className={uptimeColor}>{m.uptimePct}% uptime</span>
                        )}
                        {m.uptimePct !== null && m.checkCount90d > 0 && (
                          <span aria-hidden>·</span>
                        )}
                        {m.checkCount90d > 0 && (
                          <span>{m.checkCount90d.toLocaleString()} checks</span>
                        )}
                      </div>
                      <span>Checked {formatRelativeTime(m.lastCheckAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {incidents.length > 0 && (
          <section
            className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10"
            aria-label="Active incidents"
          >
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-400">
              Active Incidents
            </h2>
            <p className="mt-0.5 text-xs text-red-700/60 dark:text-red-400/60">
              Services currently experiencing issues
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {incidents.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-2 text-sm text-red-700 dark:text-red-400"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="shrink-0 text-xs text-red-600/70 dark:text-red-400/60">
                    {m.lastStatusChangedAt
                      ? `Down since ${formatRelativeTime(m.lastStatusChangedAt)}`
                      : "Down"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-text-muted">
          Powered by Uptime Monitor · Auto-refreshes every 60 seconds
        </p>
      </main>
    </div>
  );
}
