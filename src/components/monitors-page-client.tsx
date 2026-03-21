"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import type { Monitor } from "@/db/schema";
import { Overlay } from "@/components/overlay";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddMonitorFlow } from "@/components/add-monitor-flow";
import { EditMonitorForm } from "@/components/edit-monitor-form";
import { BulkEditMonitorsForm } from "@/components/bulk-edit-monitors-form";
import {
  SearchWithTypeahead,
  filterMonitorsBySearch,
} from "@/components/search-with-typeahead";
import { MonitorStatusBadge } from "@/components/monitor-status-badge";
import { SslBadge } from "@/components/ssl-badge";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { sortMonitors, type LatestByMonitor } from "@/lib/sort-monitors";

type MonitorConfig = {
  name: string;
  url: string;
  method?: string;
  intervalMinutes?: number;
  timeoutSeconds?: number;
  expectedStatusCodes?: string;
  alertEmail?: boolean;
  alertEmailTo?: string | null;
  sslMonitoring?: boolean;
  showOnStatusPage?: boolean;
};

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

function MonitorFavicon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="h-4 w-4 shrink-0 rounded bg-border" aria-hidden />
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-4 w-4 shrink-0 rounded"
      width={16}
      height={16}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

type DeleteConfirmState =
  | { kind: "single"; id: string; name: string }
  | { kind: "bulk"; ids: string[] };

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

function RowActionsMenu({
  monitor,
  isPausing,
  onEdit,
  onPause,
  onDelete,
}: {
  monitor: Monitor;
  isPausing: boolean;
  onEdit: (id: string) => void;
  onPause: (id: string, currentlyPaused: boolean) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleOpen() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 w-40 overflow-hidden rounded-lg border border-border bg-bg-card shadow-lg"
        >
          <Link
            href={`/monitors/${monitor.id}`}
            className="flex w-full items-center px-3.5 py-2 text-sm text-text-primary transition hover:bg-bg-page active:scale-[0.98]"
            onClick={() => setOpen(false)}
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(monitor.id); }}
            className="flex w-full items-center px-3.5 py-2 text-sm text-text-primary transition hover:bg-bg-page active:scale-[0.98]"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={isPausing}
            onClick={() => { setOpen(false); onPause(monitor.id, !!monitor.paused); }}
            className="flex w-full items-center px-3.5 py-2 text-sm text-text-primary transition hover:bg-bg-page active:scale-[0.98] disabled:opacity-50"
          >
            {isPausing
              ? monitor.paused ? "Resuming…" : "Pausing…"
              : monitor.paused ? "Resume" : "Pause"}
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(monitor.id, monitor.name); }}
            className="flex w-full items-center px-3.5 py-2 text-sm text-red-600 transition hover:bg-red-50 active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-bg-page hover:text-text-primary active:scale-90"
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </>
  );
}

export function MonitorsPageClient({
  monitors,
  latestByMonitor,
}: {
  monitors: Monitor[];
  latestByMonitor: LatestByMonitor;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editMonitorId, setEditMonitorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<{ field: string; direction: "asc" | "desc" }>({
    field: "name",
    direction: "asc",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(
    null
  );
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [bulkPauseBusy, setBulkPauseBusy] = useState(false);
  const [bulkPauseMode, setBulkPauseMode] = useState<"pause" | "resume" | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<MonitorConfig[] | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: { index: number; name: string; url: string; error: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerSelectRef = useRef<HTMLInputElement>(null);

  const filteredMonitors = filterMonitorsBySearch(monitors, searchQuery);
  const sortedMonitors = sortMonitors(
    filteredMonitors,
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );
  const editMonitor = editMonitorId
    ? monitors.find((m) => m.id === editMonitorId)
    : null;

  const visibleIds = useMemo(
    () => sortedMonitors.map((m) => m.id),
    [sortedMonitors]
  );
  const selectedCount = selectedIds.size;
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds]
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && !allVisibleSelected;

  const selectedMonitorsList = useMemo(
    () => monitors.filter((m) => selectedIds.has(m.id)),
    [monitors, selectedIds]
  );
  const allSelectedPaused =
    selectedMonitorsList.length > 0 &&
    selectedMonitorsList.every((m) => m.paused);
  const allSelectedUnpaused =
    selectedMonitorsList.length > 0 &&
    selectedMonitorsList.every((m) => !m.paused);

  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/monitors/export");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `monitors-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) {
          setImportParseError("File must contain a JSON array of monitors.");
          setImportData(null);
        } else {
          setImportParseError(null);
          setImportData(parsed as MonitorConfig[]);
        }
      } catch {
        setImportParseError("Could not parse file as JSON.");
        setImportData(null);
      }
      setImportResult(null);
      setImportOpen(true);
    };
    reader.readAsText(file);
  }

  async function handleImportConfirm() {
    if (!importData) return;
    setImporting(true);
    try {
      const res = await fetch("/api/monitors/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importData),
      });
      const data = await res.json();
      setImportResult(data);
      if (data.created > 0) router.refresh();
    } finally {
      setImporting(false);
    }
  }

  function handleImportClose() {
    setImportOpen(false);
    setImportData(null);
    setImportParseError(null);
    setImportResult(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    if (deleteConfirm.kind === "single") {
      const { id, name } = deleteConfirm;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/monitors/${id}`, { method: "DELETE" });
        if (res.ok) {
          toast.success(`"${name}" deleted`);
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Delete failed");
        }
      } finally {
        setDeletingId(null);
        setDeleteConfirm(null);
      }
      return;
    }

    const { ids } = deleteConfirm;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/monitors/${id}`, { method: "DELETE" }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "Delete failed");
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(
          ok === 1 ? "1 monitor deleted" : `${ok} monitors deleted`
        );
        if (failed > 0) {
          toast.error(
            failed === 1
              ? "1 monitor could not be deleted"
              : `${failed} monitors could not be deleted`
          );
        }
        clearSelection();
        router.refresh();
      } else {
        toast.error("Could not delete monitors");
      }
    } finally {
      setBulkDeleting(false);
      setDeleteConfirm(null);
    }
  }

  async function handleBulkPause() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkPauseMode("pause");
    setBulkPauseBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/monitors/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paused: true }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "Failed to pause");
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(ok === 1 ? "Monitor paused" : `${ok} monitors paused`);
        if (failed > 0) {
          toast.error(
            failed === 1
              ? "1 monitor could not be paused"
              : `${failed} monitors could not be paused`
          );
        }
        router.refresh();
      } else {
        toast.error("Could not pause monitors");
      }
    } finally {
      setBulkPauseBusy(false);
      setBulkPauseMode(null);
    }
  }

  async function handleBulkResume() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkPauseMode("resume");
    setBulkPauseBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/monitors/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paused: false }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error ?? "Failed to resume");
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(ok === 1 ? "Monitor resumed" : `${ok} monitors resumed`);
        if (failed > 0) {
          toast.error(
            failed === 1
              ? "1 monitor could not be resumed"
              : `${failed} monitors could not be resumed`
          );
        }
        router.refresh();
      } else {
        toast.error("Could not resume monitors");
      }
    } finally {
      setBulkPauseBusy(false);
      setBulkPauseMode(null);
    }
  }

  async function handlePause(id: string, currentlyPaused: boolean) {
    setPausingId(id);
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !currentlyPaused }),
      });
      if (res.ok) {
        toast.success(currentlyPaused ? "Monitor resumed" : "Monitor paused");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update monitor");
      }
    } finally {
      setPausingId(null);
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
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {monitors.length > 0 && (
          <div className="w-full sm:flex-1">
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFileChange}
        />
        {monitors.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card"
        >
          Import
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          Add monitor
        </button>
      </div>

      {selectedCount > 0 && monitors.length > 0 && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-page px-3 py-2.5"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="text-sm font-medium text-text-primary">
            {selectedCount} selected
            {selectedCount !== selectedVisibleCount && visibleIds.length > 0 && (
              <span className="font-normal text-text-muted">
                {" "}
                ({selectedVisibleCount} on this page)
              </span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={handleBulkPause}
              disabled={bulkPauseBusy || allSelectedPaused}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card disabled:opacity-50"
            >
              {bulkPauseMode === "pause" ? "Pausing…" : "Pause"}
            </button>
            <button
              type="button"
              onClick={handleBulkResume}
              disabled={bulkPauseBusy || allSelectedUnpaused}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card disabled:opacity-50"
            >
              {bulkPauseMode === "resume" ? "Resuming…" : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => setBulkEditOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  kind: "bulk",
                  ids: [...selectedIds],
                })
              }
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={
          deleteConfirm?.kind === "bulk"
            ? "Delete monitors"
            : "Delete monitor"
        }
        message={
          deleteConfirm === null
            ? ""
            : deleteConfirm.kind === "bulk"
              ? (() => {
                  const ids = deleteConfirm.ids;
                  const preview = ids
                    .slice(0, 3)
                    .map(
                      (id) =>
                        monitors.find((m) => m.id === id)?.name ?? "…"
                    )
                    .map((n) => `"${n}"`)
                    .join(", ");
                  const rest =
                    ids.length > 3 ? ` and ${ids.length - 3} more` : "";
                  return `Delete ${ids.length} monitors (${preview}${rest})? This cannot be undone.`;
                })()
              : `Delete "${deleteConfirm.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        destructive
        busy={deletingId !== null || bulkDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

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
      <Overlay
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        title={`Edit ${selectedMonitorsList.length} monitor${
          selectedMonitorsList.length !== 1 ? "s" : ""
        }`}
        panelClassName="max-w-2xl"
      >
        {bulkEditOpen && selectedMonitorsList.length > 0 && (
          <BulkEditMonitorsForm
            monitors={selectedMonitorsList}
            onSuccess={() => setBulkEditOpen(false)}
            onCancel={() => setBulkEditOpen(false)}
          />
        )}
      </Overlay>
      <Overlay
        open={importOpen}
        onClose={handleImportClose}
        title="Import monitors"
      >
        <div className="space-y-4">
          {importParseError ? (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {importParseError}
            </p>
          ) : importResult ? (
            <div className="space-y-3">
              <p className="text-sm text-text-primary">
                {importResult.created > 0 ? (
                  <>
                    Successfully imported{" "}
                    <span className="font-semibold">{importResult.created}</span>{" "}
                    {importResult.created === 1 ? "monitor" : "monitors"}.
                  </>
                ) : (
                  "No monitors were imported."
                )}
              </p>
              {importResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Errors ({importResult.errors.length})
                  </p>
                  <ul className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm">
                    {importResult.errors.map((e) => (
                      <li key={e.index} className="px-3 py-2">
                        <span className="font-medium text-text-primary">
                          #{e.index} {e.name || e.url || "—"}
                        </span>
                        <span className="ml-2 text-text-muted">{e.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={handleImportClose}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          ) : importData ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Ready to import{" "}
                <span className="font-semibold text-text-primary">
                  {importData.length}
                </span>{" "}
                {importData.length === 1 ? "monitor" : "monitors"}:
              </p>
              <ul className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm">
                {importData.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="font-medium text-text-primary truncate">
                      {m.name || <span className="text-text-muted italic">unnamed</span>}
                    </span>
                    <span className="text-text-muted truncate text-xs">{m.url}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleImportClose}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  disabled={importing}
                  className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-50"
                >
                  {importing
                    ? "Importing…"
                    : `Import ${importData.length} ${importData.length === 1 ? "monitor" : "monitors"}`}
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
        <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-bg-card">
          <table className="min-w-full divide-y divide-border">
            <caption className="sr-only">Your monitors</caption>
            <thead>
              <tr className="bg-bg-page">
                <th className="w-10 px-3 py-2.5">
                  <input
                    ref={headerSelectRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-input-border accent-accent"
                    aria-label="Select all monitors in this list"
                  />
                </th>
                <SortableTableHeader
                  column="name"
                  label="Monitor"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                />
                <SortableTableHeader
                  column="url"
                  label="URL"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="hidden sm:table-cell"
                />
                <SortableTableHeader
                  column="status"
                  label="Status"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                />
                <SortableTableHeader
                  column="ssl"
                  label="SSL"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="hidden sm:table-cell"
                />
                <SortableTableHeader
                  column="lastCheckAt"
                  label="Last checked"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="hidden md:table-cell"
                />
                <SortableTableHeader
                  column="intervalMinutes"
                  label="Interval"
                  currentSort={sortBy}
                  onSort={(field) =>
                    setSortBy((prev) => ({
                      field,
                      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="hidden md:table-cell"
                />
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedMonitors.map((m) => {
                const favicon = getFaviconUrl(m.url);
                const latest = latestByMonitor[m.id];
                return (
                  <tr key={m.id} className={m.paused ? "opacity-60 hover:opacity-80" : "hover:bg-bg-page"}>
                    <td className="w-10 px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        className="h-4 w-4 rounded border-input-border accent-accent"
                        aria-label={`Select ${m.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <MonitorFavicon src={favicon} />
                        <Link
                          href={`/monitors/${m.id}`}
                          className="font-medium text-text-primary transition active:scale-95 hover:text-text-muted"
                        >
                          {m.name}
                        </Link>
                      </div>
                      {/* URL shown below name on mobile */}
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline sm:hidden"
                      >
                        {m.url}
                      </a>
                      <p className="mt-0.5 hidden truncate text-xs text-text-muted sm:max-md:block">
                        {formatLastChecked(m.lastCheckAt)} · every {m.intervalMinutes}m
                      </p>
                    </td>
                    <td className="hidden max-w-[14rem] px-4 py-3 text-sm sm:table-cell">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                      >
                        {m.url}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MonitorStatusBadge paused={m.paused} latest={latest} />
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <SslBadge
                        monitoring={!!m.sslMonitoring}
                        valid={m.sslValid ?? null}
                        expiresAt={m.sslExpiresAt ?? null}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-text-muted md:table-cell">
                      {formatLastChecked(m.lastCheckAt)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-text-muted md:table-cell">
                      every {m.intervalMinutes}m
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActionsMenu
                        monitor={m}
                        isPausing={pausingId === m.id}
                        onEdit={setEditMonitorId}
                        onPause={handlePause}
                        onDelete={(id, name) =>
              setDeleteConfirm({ kind: "single", id, name })
            }
                      />
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
