"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/components/activity-context";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
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

/** UTC avoids SSR vs browser default timezone mismatch (hydration errors). */
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-x-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1
              className="text-2xl font-semibold tracking-tight text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("title")}
            </h1>
            {totalCount > 0 && (
              <span className="text-sm text-text-muted">
                {t("eventCount", { count: totalCount })}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-muted">
            {t("subtitle", { pageSize })}
          </p>
        </div>
        {totalCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={clearing}
            className="h-auto shrink-0 self-start p-0 text-sm font-normal text-text-muted hover:bg-transparent hover:text-text-primary sm:pt-0.5"
          >
            {clearing ? t("clearing") : t("clearAll")}
          </Button>
        )}
      </div>

      <div className="mt-8">
        {totalCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border-muted bg-bg-page/80 px-6 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/80 text-text-muted">
              <Activity className="size-6 opacity-80" aria-hidden />
            </div>
            <p className="mt-4 text-sm text-text-muted">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const key =
                  item.kind === "status" ? `s-${item.id}` : `d-${item.id}`;
                if (item.kind === "degradation") {
                  const ratio =
                    item.baselineP75Ms > 0
                      ? (item.recentAvgMs / item.baselineP75Ms).toFixed(1)
                      : "—";
                  return (
                    <li key={key}>
                      <div className="flex items-center gap-2 px-4 py-4 sm:gap-3 sm:px-5">
                        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                          <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200"
                            aria-hidden
                          >
                            <AlertTriangle className="size-5" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                                {t("degradationBadge")}
                              </span>
                              <Link
                                href={`/monitors/${item.monitorId}`}
                                className="font-medium text-text-primary hover:underline"
                              >
                                {item.name}
                              </Link>
                            </div>
                            <p className="mt-1 text-sm text-text-muted">
                              {t("degradationDetail", {
                                recent: item.recentAvgMs,
                                baseline: item.baselineP75Ms,
                                ratio,
                              })}
                            </p>
                            <p className="mt-1 truncate text-xs text-text-muted/90">
                              {item.url}
                            </p>
                            <p className="mt-2 text-xs tabular-nums text-text-muted">
                              {formatFullTimestamp(item.at, locale)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-text-muted hover:bg-transparent hover:text-text-primary"
                          disabled={dismissingId === item.id}
                          aria-label={t("dismissAriaLabel")}
                          title={t("dismiss")}
                          onClick={() => handleDismiss(item)}
                        >
                          {dismissingId === item.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <X className="size-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                }

                const isDown = !item.recovered;
                return (
                  <li key={key}>
                    <div className="flex items-center gap-2 px-4 py-4 sm:gap-3 sm:px-5">
                      <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-full",
                            isDown
                              ? "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                          )}
                          aria-hidden
                        >
                          {isDown ? (
                            <ArrowDownCircle className="size-5" strokeWidth={2} />
                          ) : (
                            <CheckCircle2 className="size-5" strokeWidth={2} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                isDown
                                  ? "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200"
                                  : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                              )}
                            >
                              {isDown ? t("wentDown") : t("recovered")}
                            </span>
                            <Link
                              href={`/monitors/${item.monitorId}`}
                              className="font-medium text-text-primary hover:underline"
                            >
                              {item.name}
                            </Link>
                          </div>
                          <p className="mt-1 truncate text-xs text-text-muted/90">
                            {item.url}
                          </p>
                          <p className="mt-2 text-xs tabular-nums text-text-muted">
                            {formatFullTimestamp(item.at, locale)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-text-muted hover:bg-transparent hover:text-text-primary"
                        disabled={dismissingId === item.id}
                        aria-label={t("dismissAriaLabel")}
                        title={t("dismiss")}
                        onClick={() => handleDismiss(item)}
                      >
                        {dismissingId === item.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <X className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
                <p className="text-sm text-text-muted">
                  {t("pageOf", { page, totalPages })}
                  <span className="text-text-muted/80">
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
                    href={page === 2 ? "/activity" : `/activity?page=${page - 1}`}
                    aria-disabled={page <= 1}
                    className={cn(
                      "rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
                      page <= 1
                        ? "pointer-events-none opacity-40 text-text-muted"
                        : "text-text-primary hover:bg-bg-page"
                    )}
                  >
                    {t("previous")}
                  </Link>
                  <Link
                    href={`/activity?page=${page + 1}`}
                    aria-disabled={page >= totalPages}
                    className={cn(
                      "rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
                      page >= totalPages
                        ? "pointer-events-none opacity-40 text-text-muted"
                        : "text-text-primary hover:bg-bg-page"
                    )}
                  >
                    {t("next")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
