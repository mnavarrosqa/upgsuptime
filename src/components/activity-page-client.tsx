"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/components/activity-context";

interface ActivityItem {
  id: string;
  name: string;
  url: string;
  currentStatus: boolean | null;
  lastStatusChangedAt: Date | null;
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAbsolute(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function ActivityPageClient({ items }: { items: ActivityItem[] }) {
  const { markAllRead } = useActivity();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

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
            Recent Activity
          </h1>
          {items.length > 0 && (
            <span className="text-sm text-text-muted">{items.length} event{items.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-sm text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            {clearing ? "Clearing…" : "Clear all"}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Status changes across your monitors in the last 7 days.
      </p>

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
            <p className="text-text-muted">No activity in the last 7 days.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Monitor
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Event
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isDown = item.currentStatus === false;
                  return (
                    <tr key={item.id} className="hover:bg-bg-page">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/monitors/${item.id}`}
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
                          {isDown ? "Went down" : "Recovered"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm text-text-muted"
                          title={formatAbsolute(item.lastStatusChangedAt)}
                        >
                          {formatRelative(item.lastStatusChangedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
