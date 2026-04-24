"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MonitorCardTrend, type TrendPoint } from "@/components/monitor-card-trend";
import { MonitorStatusBadge } from "@/components/monitor-status-badge";
import { DowntimeAckBadge } from "@/components/downtime-ack-controls";
import { SslBadge } from "@/components/ssl-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MonitorCardProps = {
  id: string;
  name: string;
  url: string;
  monitorType?: "http" | "keyword" | "dns" | "tcp" | null;
  paused?: boolean | null;
  latest: { ok: boolean; responseTimeMs: number | null; message?: string | null } | undefined;
  trendResults: TrendPoint[];
  lastCheckAt: Date | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: Date | string | null;
  enterDelayMs?: number;
  downtimeAcked?: boolean;
};

function getFaviconUrl(url: string, monitorType?: "http" | "keyword" | "dns" | "tcp" | null): string {
  if (monitorType === "dns" || monitorType === "tcp") return "";
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
  monitorType,
  paused,
  latest,
  trendResults,
  lastCheckAt,
  sslMonitoring,
  sslValid,
  sslExpiresAt,
  enterDelayMs = 0,
  downtimeAcked = false,
}: MonitorCardProps) {
  const router = useRouter();
  const t = useTranslations("monitorsPage");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const type = monitorType ?? "http";
  const favicon = getFaviconUrl(url, type);
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
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !paused }),
      });
      if (!res.ok) {
        throw new Error(paused ? t("failedToResume") : t("failedToPause"));
      }
      toast.success(paused ? t("monitorResumed") : t("monitorPaused"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedToUpdate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setChecking(true);
    try {
      const res = await fetch(`/api/monitors/${id}/check-now`, { method: "POST" });
      if (!res.ok) {
        throw new Error(t("checkNowFailed"));
      }
      toast.success(t("checkNowQueued"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tCommon("somethingWentWrong"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <li
      className="group relative [--enter-delay:0ms] motion-safe:motion-soft-pop"
      style={{ "--enter-delay": `${enterDelayMs}ms` } as CSSProperties}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-card p-4 shadow-sm transition-[transform,box-shadow,border-color,opacity] duration-240 [transition-timing-function:var(--motion-ease-out-quart)] hover:-translate-y-0.5 hover:border-border-muted hover:shadow active:translate-y-0 active:scale-[0.99]",
          paused ? "opacity-60" : ""
        )}
      >
        <Link
          href={`/monitors/${id}`}
          className="absolute inset-0 z-0 rounded-lg outline-offset-2"
          aria-label={t("viewDetailsFor", { name })}
        />
        {/* Header: favicon + name + status */}
        <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
        <div className="flex items-start gap-2.5">
          {favicon ? (
            <Image
              src={favicon}
              alt=""
              className="mt-0.5 h-5 w-5 shrink-0 rounded"
              width={20}
              height={20}
              unoptimized
            />
          ) : (
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-border text-xs text-text-muted"
              aria-hidden
            >
              {type === "dns" ? "D" : type === "keyword" ? "K" : type === "tcp" ? "T" : "•"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium leading-snug text-text-primary">
                  {name}
                </span>
                {type !== "http" && (
                  <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-xs font-medium text-text-muted">
                    {type === "dns" ? "DNS" : type === "tcp" ? "TCP" : "Keyword"}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <MonitorStatusBadge paused={paused} latest={latest} />
                {downtimeAcked ? <DowntimeAckBadge /> : null}
              </div>
            </div>
            {type === "dns" || type === "tcp" ? (
              <span
                className="mt-0.5 block truncate font-mono text-xs text-text-muted"
                title={url}
              >
                {url}
              </span>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto mt-0.5 truncate text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                title={url}
              >
                {url}
              </a>
            )}
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
            {sslMonitoring && type !== "dns" && type !== "tcp" && (
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
      <div className="pointer-events-auto absolute bottom-2 right-2 z-[2] flex translate-y-0 gap-1 opacity-90 transition-[opacity,transform] duration-200 [transition-timing-function:var(--motion-ease-out-quart)] md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handleCheckNow}
          title={t("checkNow")}
          aria-label={t("checkNowFor", { name })}
          disabled={checking || !!paused}
          className="h-9 w-9 rounded border-border bg-bg-card/90 text-text-muted hover:border-border-muted hover:bg-bg-card/90 hover:text-text-primary md:h-11 md:w-11 md:bg-bg-card"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "motion-safe:animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handlePauseToggle}
          title={paused ? t("resume") : t("pause")}
          aria-label={paused ? t("resumeMonitor", { name }) : t("pauseMonitor", { name })}
          disabled={loading}
          className="h-9 w-9 rounded border-border bg-bg-card/90 text-text-muted hover:border-border-muted hover:bg-bg-card/90 hover:text-text-primary md:h-11 md:w-11 md:bg-bg-card"
        >
          {paused ? (
            <Play className="h-4 w-4" aria-hidden />
          ) : (
            <Pause className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </li>
  );
}
