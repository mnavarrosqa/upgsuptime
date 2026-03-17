"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Monitor } from "@/db/schema";
import { Overlay } from "@/components/overlay";
import { AddMonitorFlow } from "@/components/add-monitor-flow";
import { EditMonitorForm } from "@/components/edit-monitor-form";
import {
  SearchWithTypeahead,
  filterMonitorsBySearch,
} from "@/components/search-with-typeahead";
import { SslBadge } from "@/components/ssl-badge";

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
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

export function MonitorsPageClient({
  monitors,
  latestByMonitor,
}: {
  monitors: Monitor[];
  latestByMonitor: Record<string, boolean>;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editMonitorId, setEditMonitorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredMonitors = filterMonitorsBySearch(monitors, searchQuery);
  const editMonitor = editMonitorId
    ? monitors.find((m) => m.id === editMonitorId)
    : null;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Monitors
        </h1>
        {monitors.length > 0 && (
          <span className="text-sm text-text-muted">{monitors.length} total</span>
        )}
      </div>

      {/* Toolbar: search + add */}
      <div className="mt-5 flex items-center gap-3">
        {monitors.length > 0 && (
          <div className="flex-1">
            <SearchWithTypeahead
              monitors={monitors.map((m) => ({
                id: m.id,
                name: m.name,
                url: m.url,
              }))}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name or URL…"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          Add monitor
        </button>
      </div>

      {/* Modals */}
      <Overlay
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add monitor"
      >
        <AddMonitorFlow
          onSuccess={() => {
            setAddOpen(false);
            router.refresh();
          }}
          onCancel={() => setAddOpen(false)}
        />
      </Overlay>
      <Overlay
        open={editMonitorId !== null}
        onClose={() => setEditMonitorId(null)}
        title="Edit monitor"
      >
        {editMonitor && (
          <EditMonitorForm
            monitor={editMonitor}
            onSuccess={() => setEditMonitorId(null)}
            onCancel={() => setEditMonitorId(null)}
          />
        )}
      </Overlay>

      {/* Content */}
      {monitors.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">No monitors yet. Add one above.</p>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border-muted bg-bg-page p-10 text-center">
          <p className="text-text-muted">No monitors match your search.</p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-3 inline-block text-sm font-medium text-text-primary hover:text-text-muted"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-border bg-bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Monitor
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  URL
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Status
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  SSL
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted md:table-cell">
                  Last checked
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMonitors.map((m) => {
                const favicon = getFaviconUrl(m.url);
                const status = latestByMonitor[m.id];
                return (
                  <tr key={m.id} className="hover:bg-bg-page">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {favicon ? (
                          <img
                            src={favicon}
                            alt=""
                            className="h-4 w-4 shrink-0 rounded"
                            width={16}
                            height={16}
                          />
                        ) : (
                          <span
                            className="h-4 w-4 shrink-0 rounded bg-border"
                            aria-hidden
                          />
                        )}
                        <Link
                          href={`/monitors/${m.id}`}
                          className="font-medium text-text-primary hover:text-text-muted"
                        >
                          {m.name}
                        </Link>
                      </div>
                      {/* URL shown below name on mobile */}
                      <p className="mt-0.5 truncate text-xs text-text-muted sm:hidden">
                        {m.url}
                      </p>
                    </td>
                    <td className="hidden max-w-[14rem] truncate px-4 py-3 text-sm text-text-muted sm:table-cell">
                      {m.url}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          status === true
                            ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                            : status === false
                              ? "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                              : "bg-border text-text-muted"
                        }`}
                      >
                        {status === true ? "Up" : status === false ? "Down" : "—"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <SslBadge
                        monitoring={!!m.sslMonitoring}
                        valid={m.sslValid ?? null}
                        expiresAt={m.sslExpiresAt ?? null}
                      />
                    </td>
                    <td className="hidden px-4 py-3 text-sm md:table-cell">
                      <span className="text-text-muted">
                        {formatLastChecked(m.lastCheckAt)}
                      </span>
                      <span className="ml-2 text-xs text-text-muted/50">
                        every {m.intervalMinutes}m
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditMonitorId(m.id)}
                          className="text-sm text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id, m.name)}
                          disabled={deletingId === m.id}
                          className="text-sm text-text-muted hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                        >
                          {deletingId === m.id ? "Deleting…" : "Delete"}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
