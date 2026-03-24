"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw } from "lucide-react";
import { MonitorCardTrend, type TrendPoint } from "@/components/monitor-card-trend";
import { MonitorStatusBadge } from "@/components/monitor-status-badge";
import { SslBadge } from "@/components/ssl-badge";

type MonitorCardProps = {
  id: string;
  name: string;
  url: string;
  paused?: boolean | null;
  latest: { ok: boolean; responseTimeMs: number | null; message?: string | null } | undefined;
  trendResults: TrendPoint[];
  lastCheckAt: Date | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: Date | string | null;
};

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const favicon = getFaviconUrl(url);
  const uptimePct =
    trendResults.length > 0
      ? Math.round(
          (trendResults.filter((r) => r.ok).length / trendResults.length) * 100
        )
      : null;

  async function handlePauseToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !paused }),
    });
    router.refresh();
    setLoading(false);
  }

  async function handleCheckNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setChecking(true);
    await fetch(`/api/monitors/${id}/check-now`, { method: "POST" });
    router.refresh();
    setChecking(false);
  }

  return (
    <li className="relative group">
      <div
        className={`relative flex h-full flex-col rounded-lg border border-border bg-bg-card p-4 shadow-sm transition hover:border-border-muted hover:shadow active:scale-[0.98] ${paused ? "opacity-60" : ""}`}
      >
        <Link
          href={`/monitors/${id}`}
          className="absolute inset-0 z-0 rounded-lg outline-offset-2"
          aria-label={`View details for ${name}`}
        />
        {/* Header: favicon + name + status */}
        <div className="pointer-events-none relative z-[1] flex flex-1 flex-col">
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
              <MonitorStatusBadge paused={paused} latest={latest} />
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto mt-0.5 truncate text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
              title={url}
            >
              {url}
            </a>
            {latest && !latest.ok && latest.message && (
              <p
                className="mt-0.5 truncate text-xs text-red-500 dark:text-red-400"
                title={latest.message}
              >
                {latest.message}
              </p>
            )}
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
        </div>
      </div>

      {/* Quick actions are always visible on touch-sized screens and enhanced on hover for larger screens */}
      <div className="pointer-events-auto absolute bottom-2 right-2 z-[2] flex gap-1 opacity-90 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCheckNow}
          title="Check now"
          disabled={checking || !!paused}
          className="flex h-9 w-9 items-center justify-center rounded border border-border bg-bg-card/90 text-text-muted hover:border-border-muted hover:text-text-primary disabled:opacity-40 md:h-11 md:w-11 md:bg-bg-card"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handlePauseToggle}
          title={paused ? "Resume" : "Pause"}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded border border-border bg-bg-card/90 text-text-muted hover:border-border-muted hover:text-text-primary disabled:opacity-40 md:h-11 md:w-11 md:bg-bg-card"
        >
          {paused ? (
            <Play className="h-4 w-4" aria-hidden />
          ) : (
            <Pause className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}
