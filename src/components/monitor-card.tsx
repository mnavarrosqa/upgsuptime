"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { MonitorCardTrend, type TrendPoint } from "@/components/monitor-card-trend";
import { MonitorFavicon } from "@/components/monitor-favicon";
import { DowntimeAckBadge } from "@/components/downtime-ack-controls";
import { SslBadge } from "@/components/ssl-badge";
import { cn } from "@/lib/utils";
import { getMonitorRadialKindFromLatest } from "@/lib/monitor-radial-glow";
import { MonitorStatusTopGlow } from "@/components/monitor-status-top-glow";
import { trendDeltaPercent, uptimePercent } from "@/lib/monitor-card-stats";

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

function formatDelta(value: number): string {
  return `${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function StatusDot({
  paused,
  latest,
  label,
}: {
  paused?: boolean | null;
  latest: { ok: boolean } | undefined;
  label: string;
}) {
  const tone = paused ? "paused" : latest?.ok ? "up" : latest ? "down" : "unknown";
  return (
    <span
      className="flex size-1.5 shrink-0 items-center justify-center"
      title={label}
      aria-label={label}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "up" && "bg-status-up",
          tone === "down" && "bg-status-down",
          (tone === "paused" || tone === "unknown") && "bg-text-muted/70"
        )}
      />
    </span>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const type = monitorType ?? "http";
  const favicon = getFaviconUrl(url, type);
  const uptimePct = uptimePercent(trendResults);
  const delta = trendDeltaPercent(trendResults);
  const negative = Boolean(latest && !latest.ok) || (delta != null && delta < 0);
  const tone = paused ? "muted" : negative ? "down" : "up";
  const canOpenUrl = type === "http" || type === "keyword";
  const sslDays =
    sslExpiresAt == null
      ? null
      : Math.ceil((new Date(sslExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const sslIssue =
    sslMonitoring &&
    type !== "dns" &&
    type !== "tcp" &&
    sslValid !== null &&
    (sslValid === false || (sslDays !== null && sslDays <= 7));
  const statusLabel = paused
    ? t("statusPaused")
    : latest?.ok
      ? t("statusUp")
      : latest
        ? t("statusDown")
        : "—";

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  async function handlePauseToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
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
    setMenuOpen(false);
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
          "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color,opacity] duration-240 [transition-timing-function:var(--motion-ease-out-quart)] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
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
          className="absolute inset-0 z-0 rounded-2xl outline-offset-2"
          aria-label={t("viewDetailsFor", { name })}
        />

        <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
          <div className="flex items-center gap-2 pr-8">
            {favicon ? (
              <MonitorFavicon src={favicon} size="sm" />
            ) : (
              <span
                className="flex size-4 shrink-0 items-center justify-center rounded bg-bg-page text-[9px] font-semibold text-text-muted"
                aria-hidden
              >
                {type === "dns" ? "D" : type === "keyword" ? "K" : type === "tcp" ? "T" : "•"}
              </span>
            )}
            <StatusDot paused={paused} latest={latest} label={statusLabel} />
            <span className="min-w-0 truncate text-[13px] font-medium text-text-primary" title={url}>
              {name}
            </span>
            {type !== "http" && (
              <span className="shrink-0 rounded-md bg-bg-page px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {type === "dns" ? "DNS" : type === "tcp" ? "TCP" : "KW"}
              </span>
            )}
            {downtimeAcked ? <DowntimeAckBadge /> : null}
            {sslIssue ? (
              <SslBadge
                monitoring={sslMonitoring}
                valid={sslValid}
                expiresAt={sslExpiresAt}
                compact
              />
            ) : null}
          </div>

          {latest && !latest.ok && latest.message ? (
            <p className="mt-1.5 truncate pr-8 text-xs font-medium text-status-down" title={latest.message}>
              {latest.message}
            </p>
          ) : null}

          <div className="mt-4 flex min-w-0 items-baseline gap-2">
            <span
              className="font-display text-[1.5rem] font-semibold leading-none tracking-tight text-text-primary tabular-nums"
              title={formatLastChecked(lastCheckAt, tTime)}
            >
              {uptimePct ?? "—"}
            </span>
            {delta != null && delta !== 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                  delta > 0 ? "text-status-up" : "text-status-down"
                )}
                aria-label={delta > 0 ? t("trendUp", { value: formatDelta(delta) }) : t("trendDown", { value: formatDelta(delta) })}
              >
                <span
                  className={cn(
                    "inline-flex size-3.5 items-center justify-center rounded-full",
                    delta > 0 ? "bg-status-up/10" : "bg-status-down/10"
                  )}
                  aria-hidden
                >
                  {delta > 0 ? (
                    <ArrowUp className="size-2.5" strokeWidth={2.5} />
                  ) : (
                    <ArrowDown className="size-2.5" strokeWidth={2.5} />
                  )}
                </span>
                {formatDelta(delta)}
              </span>
            ) : null}
            <span className="text-xs text-text-muted">{t("uptimeLabel")}</span>
          </div>

          {trendResults.length > 0 ? (
            <Link
              href={`/monitors/${id}`}
              tabIndex={-1}
              className="pointer-events-auto relative z-[2] mt-3 block min-h-28 min-w-0 flex-1 rounded-md"
            >
              <MonitorCardTrend results={trendResults} tone={tone} />
            </Link>
          ) : (
            <div className="flex-1" aria-hidden />
          )}
        </div>
      </div>

      <div className="absolute top-3.5 right-3.5 z-[3]" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          title={t("moreActions", { name })}
          aria-label={t("moreActions", { name })}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-border/60 bg-bg-card py-1 shadow-lg shadow-black/10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleCheckNow}
              disabled={checking || !!paused}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary disabled:opacity-40"
            >
              <RefreshCw className={cn("size-3.5", checking && "motion-safe:animate-spin")} aria-hidden />
              {t("checkNow")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handlePauseToggle}
              disabled={loading}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary disabled:opacity-40"
            >
              {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
              {paused ? t("resume") : t("pause")}
            </button>
            {canOpenUrl ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {t("openSite")}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
