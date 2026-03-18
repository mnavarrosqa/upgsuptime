import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { MonitorCardTrend, type TrendPoint } from "@/components/monitor-card-trend";
import { SslBadge } from "@/components/ssl-badge";

type MonitorCardProps = {
  id: string;
  name: string;
  url: string;
  paused?: boolean | null;
  latest: { ok: boolean; responseTimeMs: number | null } | undefined;
  trendResults: TrendPoint[];
  lastCheckAt: Date | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: Date | string | null;
};

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return "";
  }
}

function formatLastChecked(date: Date | null): string {
  if (!date) return "Never";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function MonitorCard({
  id,
  name,
  url,
  paused,
  latest,
  trendResults,
  lastCheckAt,
  sslMonitoring,
  sslValid,
  sslExpiresAt,
}: MonitorCardProps) {
  const favicon = getFaviconUrl(url);
  const statusLabel = latest?.ok ? "Up" : latest ? "Down" : "—";
  const StatusIcon = latest?.ok ? CheckCircle : latest ? XCircle : null;
  const uptimePct =
    trendResults.length > 0
      ? Math.round(
          (trendResults.filter((r) => r.ok).length / trendResults.length) * 100
        )
      : null;

  return (
    <li>
      <Link
        href={`/monitors/${id}`}
        className={`flex h-full flex-col rounded-lg border border-border bg-bg-card p-4 shadow-sm transition hover:border-border-muted hover:shadow active:scale-[0.98] ${paused ? "opacity-60" : ""}`}
      >
        {/* Header: favicon + name + status */}
        <div className="flex items-start gap-2.5">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="mt-0.5 h-5 w-5 shrink-0 rounded"
              width={20}
              height={20}
            />
          ) : (
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-border text-xs text-text-muted"
              aria-hidden
            >
              •
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate font-medium leading-snug text-text-primary">
                {name}
              </span>
              {paused ? (
                <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium bg-border text-text-muted">
                  Paused
                </span>
              ) : (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    latest?.ok
                      ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                      : latest
                        ? "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                        : "bg-border text-text-muted"
                  }`}
                >
                  {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden />}
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted" title={url}>
              {url}
            </p>
          </div>
        </div>

        {/* Trend bars */}
        {trendResults.length > 0 && (
          <div className="mt-3">
            <MonitorCardTrend results={trendResults} />
          </div>
        )}

        {/* Footer: uptime % · response time · SSL + last checked */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            {uptimePct !== null && (
              <span
                className={
                  uptimePct === 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : uptimePct >= 90
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                }
              >
                {uptimePct}%
              </span>
            )}
            {latest?.responseTimeMs != null && (
              <>
                {uptimePct !== null && <span aria-hidden>·</span>}
                <span>{latest.responseTimeMs}ms</span>
              </>
            )}
            {sslMonitoring && (
              <>
                <span aria-hidden>·</span>
                <SslBadge
                  monitoring={sslMonitoring}
                  valid={sslValid}
                  expiresAt={sslExpiresAt}
                  compact
                />
              </>
            )}
          </div>
          <span>{formatLastChecked(lastCheckAt)}</span>
        </div>
      </Link>
    </li>
  );
}
