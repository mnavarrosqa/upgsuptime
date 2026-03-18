"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Pause, Play, RefreshCw } from "lucide-react";
import { MonitorCardTrend, type TrendPoint } from "@/components/monitor-card-trend";
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
  const isDown = latest && !latest.ok && !paused;
  const isUp = latest?.ok && !paused;
  const uptimePct =
    trendResults.length > 0
      ? Math.round(
          (trendResults.filter((r) => r.ok).length / trendResults.length) * 100
        )
      : null;

  const leftBorderColor = isDown
    ? "#ef4444"
    : isUp
      ? "#10b981"
      : undefined;

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
      <Link
        href={`/monitors/${id}`}
        className={`flex h-full flex-col rounded-lg border border-l-4 border-border bg-bg-card p-4 shadow-sm transition hover:border-border-muted hover:shadow active:scale-[0.98] ${paused ? "opacity-60" : ""}`}
        style={leftBorderColor ? { borderLeftColor: leftBorderColor } : undefined}
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
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    latest?.ok
                      ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                      : latest
                        ? "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                        : "bg-border text-text-muted"
                  }`}
                >
                  {latest?.ok ? (
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                  ) : latest ? (
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                    </span>
                  ) : null}
                  {latest?.ok ? "Up" : latest ? "Down" : "—"}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted" title={url}>
              {url}
            </p>
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
      </Link>

      {/* Hover quick-actions */}
      <div className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCheckNow}
          title="Check now"
          disabled={checking || !!paused}
          className="rounded border border-border bg-bg-card p-1.5 text-text-muted hover:border-border-muted hover:text-text-primary disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handlePauseToggle}
          title={paused ? "Resume" : "Pause"}
          disabled={loading}
          className="rounded border border-border bg-bg-card p-1.5 text-text-muted hover:border-border-muted hover:text-text-primary disabled:opacity-40"
        >
          {paused ? (
            <Play className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Pause className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}
