"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
import type { ActivityItem } from "@/lib/activity-item";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

export type { ActivityItem };

function subscribeNoop() {
  return () => {};
}

/** True after hydration; until then render in UTC so server and client agree. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function formatFullTimestamp(iso: string, locale: string, timeZone: string | undefined): string {
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
    timeZone,
    timeZoneName: "short",
  }).format(d);
}

/** Calendar day key (YYYY-MM-DD) of an instant in the given time zone. */
function dayKey(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

type DayGroup = { key: string; label: string; items: ActivityItem[] };

/** Groups newest-first items by calendar day, labelled "today", "yesterday" or the date. */
function groupByDay(items: ActivityItem[], locale: string, timeZone: string | undefined, now: Date): DayGroup[] {
  const todayKey = dayKey(now, timeZone);
  const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone });
  const groups: DayGroup[] = [];
  for (const item of items) {
    const at = new Date(item.at);
    const key = dayKey(at, timeZone);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label =
        key === todayKey ? relative.format(0, "day") : key === yesterdayKey ? relative.format(-1, "day") : dateLabel.format(at);
      group = { key, label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
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
  const hydrated = useHydrated();
  // Viewer's own time zone once hydrated; UTC on the server.
  const timeZone = hydrated ? undefined : DEFAULT_TIME_ZONE;
  const [now] = useState(() => new Date());
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });

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
          <div className="space-y-8">
            {groupByDay(items, locale, timeZone, now).map((group) => (
              <section key={group.key} aria-labelledby={`activity-day-${group.key}`}>
                <h2
                  id={`activity-day-${group.key}`}
                  className="text-xs font-medium uppercase tracking-wider text-text-muted"
                >
                  {group.label}
                </h2>
                <ul className="mt-2 divide-y divide-border/70 border-y border-border/70">
                  {group.items.map((item) => {
                    const key = item.kind === "status" ? `s-${item.id}` : `d-${item.id}`;
                    const common = {
                      monitorName: item.name,
                      monitorHref: `/monitors/${item.monitorId}`,
                      time: clock.format(new Date(item.at)),
                      fullTime: formatFullTimestamp(item.at, locale, timeZone),
                      dismissing: dismissingId === item.id,
                      onDismiss: () => handleDismiss(item),
                      dismissLabel: t("dismissAriaLabel"),
                    };

                    if (item.kind === "degradation") {
                      const ratio =
                        item.baselineP75Ms > 0 ? (item.recentAvgMs / item.baselineP75Ms).toFixed(1) : "—";
                      return (
                        <ActivityRow
                          key={key}
                          {...common}
                          icon={<AlertTriangle className="size-4 text-status-warn" strokeWidth={2.25} aria-hidden />}
                          badge={
                            <span className={`${badgeClass} ${statusSoftWarnClass}`}>{t("degradationBadge")}</span>
                          }
                          detail={t("degradationDetail", {
                            recent: item.recentAvgMs,
                            baseline: item.baselineP75Ms,
                            ratio,
                          })}
                        />
                      );
                    }

                    const isDown = !item.recovered;
                    return (
                      <ActivityRow
                        key={key}
                        {...common}
                        icon={
                          isDown ? (
                            <ArrowDownCircle className="size-4 text-status-down" strokeWidth={2.25} aria-hidden />
                          ) : (
                            <CheckCircle2 className="size-4 text-status-up" strokeWidth={2.25} aria-hidden />
                          )
                        }
                        badge={
                          <span className={cn(badgeClass, isDown ? statusSoftDownClass : statusSoftUpClass)}>
                            {isDown ? t("wentDown") : t("recovered")}
                          </span>
                        }
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
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

const badgeClass = "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none";

function ActivityRow({
  icon,
  badge,
  monitorName,
  monitorHref,
  detail,
  time,
  fullTime,
  dismissing,
  onDismiss,
  dismissLabel,
}: {
  icon: React.ReactNode;
  badge: React.ReactNode;
  monitorName: string;
  monitorHref: string;
  detail?: string;
  time: string;
  fullTime: string;
  dismissing: boolean;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  return (
    <li className="group flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={monitorHref} className="text-sm font-medium text-text-primary hover:underline">
            {monitorName}
          </Link>
          {badge}
        </div>
        {detail && <p className="mt-1 text-[13px] leading-snug text-text-muted">{detail}</p>}
      </div>
      <time
        className="mt-0.5 shrink-0 text-xs tabular-nums text-text-muted"
        title={fullTime}
        suppressHydrationWarning
      >
        {time}
      </time>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-my-1 shrink-0 text-text-muted opacity-100 transition-opacity hover:bg-transparent hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        disabled={dismissing}
        aria-label={`${dismissLabel}: ${monitorName}`}
        onClick={onDismiss}
      >
        {dismissing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />}
      </Button>
    </li>
  );
}
