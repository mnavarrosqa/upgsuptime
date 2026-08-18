"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/components/activity-context";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  statusSoftDownClass,
  statusSoftUpClass,
  statusSoftWarnClass,
} from "@/lib/monitor-ui";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

export type ActivityItem =
  | {
      kind: "status";
      id: string;
      monitorId: string;
      name: string;
      url: string;
      recovered: boolean;
      at: string;
    }
  | {
      kind: "degradation";
      id: string;
      monitorId: string;
      name: string;
      url: string;
      recentAvgMs: number;
      baselineP75Ms: number;
      at: string;
    };

function formatFullTimestamp(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "<1m";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

type ActivityPageClientProps = {
  items: ActivityItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
};

export function ActivityPageClient({
  items,
  page,
  totalPages,
  totalCount,
  pageSize,
}: ActivityPageClientProps) {
  const { markAllRead } = useActivity();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const t = useTranslations("activity");
  const locale = useLocale();

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  async function handleClear() {
    setClearing(true);
    try {
      await fetch("/api/activity/clear", { method: "POST" });
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  async function handleDismiss(item: ActivityItem) {
    setDismissingId(item.id);
    try {
      const res = await fetch("/api/activity/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, kind: item.kind }),
      });
      if (res.ok) router.refresh();
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              className="text-2xl font-semibold tracking-tight text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("title")}
            </h1>
            {totalCount > 0 && (
              <span className="rounded-full bg-text-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-text-muted">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            {t("subtitle", { pageSize })}
          </p>
        </div>
        {totalCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={clearing}
            className="shrink-0 gap-1.5 text-text-muted hover:text-text-primary"
          >
            {clearing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3.5" aria-hidden />
            )}
            {t("clearAll")}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {totalCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border-muted px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/60">
              <Activity className="size-5 text-text-muted" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">
              {t("empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const key =
                item.kind === "status" ? `s-${item.id}` : `d-${item.id}`;
              const isLast = idx === items.length - 1;

              if (item.kind === "degradation") {
                const ratio =
                  item.baselineP75Ms > 0
                    ? (item.recentAvgMs / item.baselineP75Ms).toFixed(1)
                    : "—";
                return (
                  <ActivityCard
                    key={key}
                    icon={
                      <div
                        className={`flex size-9 items-center justify-center rounded-full ${statusSoftWarnClass}`}
                        aria-hidden
                      >
                        <AlertTriangle className="size-4" strokeWidth={2.25} />
                      </div>
                    }
                    badge={
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none ${statusSoftWarnClass}`}
                      >
                        {t("degradationBadge")}
                      </span>
                    }
                    monitorName={item.name}
                    monitorHref={`/monitors/${item.monitorId}`}
                    detail={t("degradationDetail", {
                      recent: item.recentAvgMs,
                      baseline: item.baselineP75Ms,
                      ratio,
                    })}
                    relativeTime={formatRelativeTime(item.at)}
                    fullTime={formatFullTimestamp(item.at, locale)}
                    dismissing={dismissingId === item.id}
                    onDismiss={() => handleDismiss(item)}
                    dismissLabel={t("dismissAriaLabel")}
                    isLast={isLast}
                  />
                );
              }

              const isDown = !item.recovered;
              return (
                <ActivityCard
                  key={key}
                  icon={
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full",
                        isDown ? statusSoftDownClass : statusSoftUpClass
                      )}
                      aria-hidden
                    >
                      {isDown ? (
                        <ArrowDownCircle
                          className="size-4"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <CheckCircle2 className="size-4" strokeWidth={2.25} />
                      )}
                    </div>
                  }
                  badge={
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                        isDown ? statusSoftDownClass : statusSoftUpClass
                      )}
                    >
                      {isDown ? t("wentDown") : t("recovered")}
                    </span>
                  }
                  monitorName={item.name}
                  monitorHref={`/monitors/${item.monitorId}`}
                  relativeTime={formatRelativeTime(item.at)}
                  fullTime={formatFullTimestamp(item.at, locale)}
                  dismissing={dismissingId === item.id}
                  onDismiss={() => handleDismiss(item)}
                  dismissLabel={t("dismissAriaLabel")}
                  isLast={isLast}
                />
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm tabular-nums text-text-muted">
              {t("pageOf", { page, totalPages })}
              <span className="text-text-muted/70">
                {" "}
                {t("showingRange", {
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, totalCount),
                  total: totalCount,
                })}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={
                  page === 2 ? "/activity" : `/activity?page=${page - 1}`
                }
                aria-disabled={page <= 1}
                className={cn(
                  "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                  page <= 1
                    ? "pointer-events-none opacity-40 text-text-muted"
                    : "text-text-primary hover:bg-muted/50"
                )}
              >
                {t("previous")}
              </Link>
              <Link
                href={`/activity?page=${page + 1}`}
                aria-disabled={page >= totalPages}
                className={cn(
                  "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                  page >= totalPages
                    ? "pointer-events-none opacity-40 text-text-muted"
                    : "text-text-primary hover:bg-muted/50"
                )}
              >
                {t("next")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityCard({
  icon,
  badge,
  monitorName,
  monitorHref,
  detail,
  relativeTime,
  fullTime,
  dismissing,
  onDismiss,
  dismissLabel,
  isLast,
}: {
  icon: React.ReactNode;
  badge: React.ReactNode;
  monitorName: string;
  monitorHref: string;
  detail?: string;
  relativeTime: string;
  fullTime: string;
  dismissing: boolean;
  onDismiss: () => void;
  dismissLabel: string;
  isLast: boolean;
}) {
  return (
    <div className="group relative flex gap-3 sm:gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        {icon}
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-border" aria-hidden />
        )}
      </div>

      {/* Card content */}
      <div className="min-w-0 flex-1 pb-5">
        <div className="rounded-lg border border-border bg-bg-card p-3 shadow-sm transition-colors sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {badge}
                <Link
                  href={monitorHref}
                  className="text-sm font-medium text-text-primary hover:underline"
                >
                  {monitorName}
                </Link>
                <span
                  className="text-xs tabular-nums text-text-muted/70"
                  title={fullTime}
                >
                  {relativeTime}
                </span>
              </div>
              {detail && (
                <p className="mt-1.5 text-[13px] leading-snug text-text-muted">
                  {detail}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-text-muted opacity-100 transition-opacity hover:bg-transparent hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:data-[state=open]:opacity-100"
              disabled={dismissing}
              aria-label={dismissLabel}
              onClick={onDismiss}
            >
              {dismissing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <X className="size-3.5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
