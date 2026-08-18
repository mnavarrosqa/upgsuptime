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
import { MonitorStatusTopGlow } from "@/components/monitor-status-top-glow";
import { DowntimeAckBadge } from "@/components/downtime-ack-controls";
import { SslBadge } from "@/components/ssl-badge";
import { cn } from "@/lib/utils";
import { getMonitorRadialKindFromLatest } from "@/lib/monitor-radial-glow";

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

function formatLastChecked(
  date: Date | null,
  tTime: (key: string, values?: Record<string, number>) => string
): string {
  if (!date) return tTime("never");
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return tTime("justNow");
  if (diffMin < 60) return tTime("minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return tTime("hoursAgo", { count: diffHr });
  return tTime("daysAgo", { count: Math.floor(diffHr / 24) });
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
  const tTime = useTranslations("time");
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
          "relative flex h-full flex-col overflow-hidden rounded-xl border bg-bg-card p-4 shadow-sm transition-[transform,box-shadow,border-color,opacity] duration-240 [transition-timing-function:var(--motion-ease-out-quart)] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] sm:p-5",
          paused
            ? "border-border opacity-60"
            : latest && !latest.ok
              ? "border-status-down/30 hover:border-status-down/50"
              : "border-border/60 hover:border-border-muted"
        )}
      >
        <MonitorStatusTopGlow kind={getMonitorRadialKindFromLatest(paused, latest)} />
        <Link
          href={`/monitors/${id}`}
          className="absolute inset-0 z-0 rounded-xl outline-offset-2"
          aria-label={t("viewDetailsFor", { name })}
        />

        <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
          {/* Header: favicon + name + status */}
          <div className="flex items-start gap-3">
            {favicon ? (
              <Image
                src={favicon}
                alt=""
                className="mt-0.5 size-6 shrink-0 rounded-md"
                width={24}
                height={24}
                unoptimized
              />
            ) : (
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-page text-[10px] font-semibold text-text-muted"
                aria-hidden
              >
                {type === "dns" ? "D" : type === "keyword" ? "K" : type === "tcp" ? "T" : "•"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-display text-[15px] font-semibold leading-snug text-text-primary">
                    {name}
                  </span>
                  {type !== "http" && (
                    <span className="shrink-0 rounded-md bg-bg-page px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {type === "dns" ? "DNS" : type === "tcp" ? "TCP" : "KW"}
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
                  className="mt-1 block truncate font-mono text-xs text-text-muted/80"
                  title={url}
                >
                  {url}
                </span>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto mt-1 block truncate text-xs text-text-muted/80 underline-offset-2 hover:text-text-primary hover:underline"
                  title={url}
                >
                  {url}
                </a>
              )}
              {latest && !latest.ok && latest.message && (
                <p
                  className="mt-1 truncate text-xs font-medium text-status-down"
                  title={latest.message}
                >
                  {latest.message}
                </p>
              )}
            </div>
          </div>

          {/* Trend bars */}
          {trendResults.length > 0 && (
            <div className="mt-4">
              <MonitorCardTrend results={trendResults} />
            </div>
          )}

          {/* Footer: uptime % · response time · SSL | last checked */}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-2 tabular-nums">
              {uptimePct !== null && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                    uptimePct === 100
                      ? "bg-status-up/10 text-status-up"
                      : uptimePct >= 90
                        ? "bg-status-warn/10 text-status-warn"
                        : "bg-status-down/10 text-status-down"
                  )}
                >
                  {uptimePct}%
                </span>
              )}
              {latest?.responseTimeMs != null && (
                <span className="text-text-muted/80">{latest.responseTimeMs}ms</span>
              )}
              {sslMonitoring && type !== "dns" && type !== "tcp" && (
                <SslBadge
                  monitoring={sslMonitoring}
                  valid={sslValid}
                  expiresAt={sslExpiresAt}
                  compact
                />
              )}
            </div>
            <span className="text-text-muted/60">{formatLastChecked(lastCheckAt, tTime)}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="pointer-events-auto absolute bottom-3 right-3 z-[2] flex translate-y-0 gap-1 opacity-90 transition-[opacity,transform] duration-200 [transition-timing-function:var(--motion-ease-out-quart)] md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCheckNow}
          title={t("checkNow")}
          aria-label={t("checkNowFor", { name })}
          disabled={checking || !!paused}
          className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-bg-card/95 text-text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-border-muted hover:text-text-primary disabled:opacity-40 md:size-9"
        >
          <RefreshCw className={`size-3.5 ${checking ? "motion-safe:animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handlePauseToggle}
          title={paused ? t("resume") : t("pause")}
          aria-label={paused ? t("resumeMonitor", { name }) : t("pauseMonitor", { name })}
          disabled={loading}
          className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-bg-card/95 text-text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-border-muted hover:text-text-primary disabled:opacity-40 md:size-9"
        >
          {paused ? (
            <Play className="size-3.5" aria-hidden />
          ) : (
            <Pause className="size-3.5" aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}
