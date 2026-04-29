"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  Layers,
  XCircle,
} from "lucide-react";
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
import { sortMonitors, type LatestByMonitor } from "@/lib/sort-monitors";
import { Button } from "@/components/ui/button";
import { MonitorsListView } from "@/components/monitors-list-view";
import { cn } from "@/lib/utils";

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

type DeleteConfirmState =
  | { kind: "single"; id: string; name: string }
  | { kind: "bulk"; ids: string[] };

type ImportResult = {
  created: number;
  errors: { index: number; name: string; url: string; error: string }[];
  error?: string;
};

export function MonitorsPageClient({
  monitors,
  latestByMonitor,
}: {
  monitors: Monitor[];
  latestByMonitor: LatestByMonitor;
}) {
  const router = useRouter();
  const t = useTranslations("monitorsPage");
  const tDash = useTranslations("dashboard");
  const [addOpen, setAddOpen] = useState(false);
  const [addFormDirty, setAddFormDirty] = useState(false);
  const [confirmCloseAddOpen, setConfirmCloseAddOpen] = useState(false);
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
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerSelectRef = useRef<HTMLInputElement>(null);

  const filteredMonitors = filterMonitorsBySearch(monitors, searchQuery);
  const sortedMonitors = sortMonitors(
    filteredMonitors,
    sortBy.field,
    sortBy.direction,
    latestByMonitor
  );

  const upCount = useMemo(
    () => monitors.filter((m) => latestByMonitor[m.id]?.ok === true).length,
    [monitors, latestByMonitor]
  );
  const downCount = useMemo(
    () =>
      monitors.filter((m) => {
        const latest = latestByMonitor[m.id];
        return latest && !latest.ok;
      }).length,
    [monitors, latestByMonitor]
  );
  const allUp = monitors.length > 0 && downCount === 0;

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

  useEffect(() => {
    const validIds = new Set(monitors.map((m) => m.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [monitors]);

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
          setImportParseError(t("importJsonArray"));
          setImportData(null);
        } else {
          setImportParseError(null);
          setImportData(parsed as MonitorConfig[]);
        }
      } catch {
        setImportParseError(t("importParseError"));
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
      const result: ImportResult = {
        created: typeof data.created === "number" ? data.created : 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
        error: typeof data.error === "string" ? data.error : undefined,
      };
      setImportResult(result);
      if (res.ok && result.created > 0) router.refresh();
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
          toast.success(t("deleteSuccessSingle", { name }));
          setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? t("deleteFailed"));
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
              throw new Error(data.error ?? t("deleteFailed"));
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(t("deleteSuccessBulk", { count: ok }));
        if (failed > 0) {
          toast.error(t("deletePartialFailed", { count: failed }));
        }
        clearSelection();
        router.refresh();
      } else {
        toast.error(t("couldNotDelete"));
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
              throw new Error(data.error ?? t("failedToPause"));
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(ok === 1 ? t("monitorPaused") : t("monitorsPaused", { count: ok }));
        if (failed > 0) {
          toast.error(t("pausePartialFailed", { count: failed }));
        }
        router.refresh();
      } else {
        toast.error(t("couldNotPause"));
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
              throw new Error(data.error ?? t("failedToResume"));
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok > 0) {
        toast.success(ok === 1 ? t("monitorResumed") : t("monitorsResumed", { count: ok }));
        if (failed > 0) {
          toast.error(t("resumePartialFailed", { count: failed }));
        }
        router.refresh();
      } else {
        toast.error(t("couldNotResume"));
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
        toast.success(currentlyPaused ? t("monitorResumed") : t("monitorPaused"));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("failedToUpdate"));
      }
    } finally {
      setPausingId(null);
    }
  }

  function closeAddOverlay() {
    setAddFormDirty(false);
    setConfirmCloseAddOpen(false);
    setAddOpen(false);
  }

  function handleAddCloseRequest() {
    if (addFormDirty) {
      setConfirmCloseAddOpen(true);
      return;
    }
    closeAddOverlay();
  }

  return (
    <>
      <div className="motion-safe:motion-enter">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("title")}
        </h1>
        {monitors.length > 0 && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              allUp
                ? "bg-emerald-600 text-white dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-600 text-white dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            <span
              className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center"
              aria-hidden
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full bg-white/80 dark:bg-current",
                  allUp && "animate-operational-badge-dot"
                )}
              />
            </span>
            {allUp ? tDash("allOperational") : tDash("downCount", { count: downCount })}
          </span>
        )}
      </div>

      {monitors.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="border-b border-border/80 bg-gradient-to-b from-muted/40 to-transparent px-2.5 py-2 dark:from-muted/25 sm:px-3 sm:py-2">
            <p
              className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("overviewHeading")}
            </p>
          </div>
          <div className="p-2.5 sm:p-3">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="flex min-w-0 flex-col rounded-lg border border-border/80 bg-muted/35 px-2 py-2 dark:bg-muted/20 sm:px-2.5 sm:py-2.5">
                <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted">
                  <Layers className="size-3 shrink-0 opacity-80" aria-hidden />
                  {tDash("statLabelTotal")}
                </span>
                <p
                  className="mt-1.5 text-lg font-semibold tabular-nums text-text-primary sm:text-xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {monitors.length}
                </p>
              </div>
              <div className="flex min-w-0 flex-col rounded-lg border border-border/80 bg-emerald-500/[0.06] px-2 py-2 dark:bg-emerald-500/10 sm:px-2.5 sm:py-2.5">
                <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/90">
                  <CheckCircle2 className="size-3 shrink-0 opacity-90" aria-hidden />
                  {tDash("statLabelUp")}
                </span>
                <p className="mt-1.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-xl">
                  {upCount}
                </p>
              </div>
              <div
                className={cn(
                  "flex min-w-0 flex-col rounded-lg border px-2 py-2 sm:px-2.5 sm:py-2.5",
                  downCount > 0
                    ? "border-red-500/35 bg-red-500/[0.06] dark:bg-red-500/10"
                    : "border-border/80 bg-muted/35 dark:bg-muted/20"
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider",
                    downCount > 0
                      ? "text-red-700 dark:text-red-400/90"
                      : "text-text-muted"
                  )}
                >
                  <XCircle className="size-3 shrink-0 opacity-90" aria-hidden />
                  {tDash("statLabelDown")}
                </span>
                <p
                  className={cn(
                    "mt-1.5 text-lg font-semibold tabular-nums sm:text-xl",
                    downCount > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-text-muted"
                  )}
                >
                  {downCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: search + export + import + add */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          monitors.length > 0 ? "mt-5" : "mt-6"
        )}
      >
        <div className="p-3 sm:p-4 [--enter-delay:90ms] motion-safe:motion-soft-pop">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {monitors.length > 0 && (
          <div className="min-w-0 w-full sm:flex-1">
            <SearchWithTypeahead
              monitors={monitors.map((m) => ({
                id: m.id,
                name: m.name,
                url: m.url,
              }))}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("searchPlaceholder")}
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
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto sm:justify-start">
        {monitors.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-muted/50"
          >
            {exporting ? t("exporting") : t("export")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-muted/50"
        >
          {t("import")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => setAddOpen(true)}
          className="rounded-md px-4 py-2 text-sm font-medium"
        >
          {t("addMonitor")}
        </Button>
        </div>
          </div>
        </div>
      </div>

      {selectedCount > 0 && monitors.length > 0 && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-elevated/80 px-3 py-2.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          role="region"
          aria-label={t("bulkActions")}
        >
          <span className="text-sm font-medium text-text-primary">
            {t("selected", { count: selectedCount })}
            {selectedCount !== selectedVisibleCount && visibleIds.length > 0 && (
              <span className="font-normal text-text-muted">
                {" "}
                {t("selectedOnPage", { count: selectedVisibleCount })}
              </span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleBulkPause}
              disabled={bulkPauseBusy || allSelectedPaused}
              className="rounded-md border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card"
            >
              {bulkPauseMode === "pause" ? t("pausing") : t("pause")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleBulkResume}
              disabled={bulkPauseBusy || allSelectedUnpaused}
              className="rounded-md border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card"
            >
              {bulkPauseMode === "resume" ? t("resuming") : t("resume")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkEditOpen(true)}
              className="rounded-md border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-card"
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteConfirm({
                  kind: "bulk",
                  ids: [...selectedIds],
                })
              }
              className="rounded-md border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {t("delete")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={clearSelection}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-primary"
            >
              {t("clear")}
            </Button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={
          deleteConfirm?.kind === "bulk"
            ? t("deleteMonitorsTitle")
            : t("deleteMonitorTitle")
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
                  const moreSuffix =
                    ids.length > 3 ? t("andMore", { count: ids.length - 3 }) : "";
                  return t("deleteBulkMessage", {
                    count: ids.length,
                    preview: `${preview}${moreSuffix}`,
                  });
                })()
              : t("deleteSingleMessage", { name: deleteConfirm.name })
        }
        confirmLabel={t("delete")}
        destructive
        busy={deletingId !== null || bulkDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Modals */}
      <Overlay
        open={addOpen}
        onClose={handleAddCloseRequest}
        title={t("addMonitorTitle")}
        panelClassName="max-w-2xl"
      >
        <AddMonitorFlow
          onSuccess={() => {
            closeAddOverlay();
            router.refresh();
          }}
          onCancel={closeAddOverlay}
          onDirtyChange={setAddFormDirty}
        />
      </Overlay>
      <ConfirmDialog
        open={confirmCloseAddOpen}
        title={t("unsavedAddMonitorTitle")}
        message={t("unsavedAddMonitorMessage")}
        confirmLabel={t("leaveForm")}
        destructive
        onConfirm={closeAddOverlay}
        onCancel={() => setConfirmCloseAddOpen(false)}
      />
      <Overlay
        open={editMonitorId !== null}
        onClose={() => setEditMonitorId(null)}
        title={t("editMonitorTitle")}
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
        title={t("bulkEditTitle", { count: selectedMonitorsList.length })}
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
        title={t("importTitle")}
      >
        <div className="space-y-4">
          {importParseError ? (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {importParseError}
            </p>
          ) : importResult ? (
            <div className="space-y-3">
              {importResult.error ? (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {importResult.error}
                </p>
              ) : (
                <p className="text-sm text-text-primary">
                  {importResult.created > 0 ? (
                    t("importSuccess", { count: importResult.created })
                  ) : (
                    t("importNone")
                  )}
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    {t("importErrors", { count: importResult.errors.length })}
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
              <Button
                type="button"
                variant="default"
                onClick={handleImportClose}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
              >
                {t("importDone")}
              </Button>
            </div>
          ) : importData ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                {t("importReady", { count: importData.length })}
              </p>
              <ul className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm">
                {importData.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="font-medium text-text-primary truncate">
                      {m.name || <span className="text-text-muted italic">{t("unnamed")}</span>}
                    </span>
                    <span className="text-text-muted truncate text-xs">{m.url}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImportClose}
                  className="flex-1 rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card"
                >
                  {t("importCancel")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={handleImportConfirm}
                  disabled={importing}
                  className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
                >
                  {importing
                    ? t("importingLabel")
                    : t("importConfirm", { count: importData.length })}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Overlay>

      {/* Content */}
      {monitors.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-muted bg-bg-card/50 p-8 text-center sm:p-12">
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-text-muted">
              <Activity className="size-6" aria-hidden />
            </span>
            <h2
              className="mt-4 text-lg font-semibold tracking-tight text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("emptyTitle")}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{t("emptyBody")}</p>
            <Button
              type="button"
              variant="default"
              className="mt-6"
              onClick={() => setAddOpen(true)}
            >
              {t("addMonitor")}
            </Button>
          </div>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-muted bg-bg-card/50 p-8 text-center sm:p-12">
          <h2
            className="text-lg font-semibold tracking-tight text-text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tDash("noSearchTitle")}
          </h2>
          <p className="mt-2 text-sm text-text-muted">{tDash("noSearchMatch")}</p>
          <Button
            type="button"
            variant="link"
            onClick={() => setSearchQuery("")}
            className="mt-4 h-auto p-0 text-sm font-medium text-primary underline-offset-4 hover:text-primary/80"
          >
            {tDash("clearSearch")}
          </Button>
        </div>
      ) : (
        <MonitorsListView
          monitors={sortedMonitors}
          latestByMonitor={latestByMonitor}
          selectedIds={selectedIds}
          headerSelectRef={headerSelectRef}
          allVisibleSelected={allVisibleSelected}
          sortBy={sortBy}
          onSortChange={(field) =>
            setSortBy((prev) => ({
              field,
              direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
            }))
          }
          onToggleSelected={toggleSelected}
          onToggleSelectAllVisible={toggleSelectAllVisible}
          pausingId={pausingId}
          onEdit={setEditMonitorId}
          onPause={handlePause}
          onDelete={(id, name) => setDeleteConfirm({ kind: "single", id, name })}
        />
      )}
      </div>
    </>
  );
}
