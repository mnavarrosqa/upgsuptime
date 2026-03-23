"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/components/activity-context";
import { useLocale, useTranslations } from "next-intl";

interface ActivityItem {
  /** Check result row id (unique per transition event). */
  id: string;
  monitorId: string;
  name: string;
  url: string;
  /** True = transitioned to up, false = transitioned to down. */
  recovered: boolean;
  /** ISO 8601 timestamp from the server. */
  at: string;
}

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

  return (
    <>
      <div className="flex items-center justify-between gap-x-3">
        <div className="flex items-center gap-x-3">
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
        {totalCount > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-sm text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            {clearing ? t("clearing") : t("clearAll")}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {t("subtitle", { pageSize })}
      </p>

      <div className="mt-6">
        {totalCount === 0 ? (
          <div className="rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
            <p className="text-text-muted">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t("colMonitor")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t("colEvent")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t("colWhen")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isDown = !item.recovered;
                  return (
                    <tr key={item.id} className="hover:bg-bg-page">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/monitors/${item.monitorId}`}
                            className="font-medium text-text-primary hover:text-text-muted"
                          >
                            {item.name}
                          </Link>
                          <span className="mt-0.5 truncate text-xs text-text-muted max-w-[14rem]">
                            {item.url}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isDown
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isDown ? "bg-red-500" : "bg-emerald-500"
                            }`}
                          />
                          {isDown ? t("wentDown") : t("recovered")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-muted tabular-nums whitespace-nowrap">
                          {formatFullTimestamp(item.at, locale)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
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
                    className={`rounded-md border border-border px-3 py-1.5 text-sm transition-colors ${
                      page <= 1
                        ? "pointer-events-none opacity-40 text-text-muted"
                        : "text-text-primary hover:bg-bg-page"
                    }`}
                  >
                    {t("previous")}
                  </Link>
                  <Link
                    href={`/activity?page=${page + 1}`}
                    aria-disabled={page >= totalPages}
                    className={`rounded-md border border-border px-3 py-1.5 text-sm transition-colors ${
                      page >= totalPages
                        ? "pointer-events-none opacity-40 text-text-muted"
                        : "text-text-primary hover:bg-bg-page"
                    }`}
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
