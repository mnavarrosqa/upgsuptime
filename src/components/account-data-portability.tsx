"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_ACCOUNT_IMPORT_BODY_BYTES } from "@/lib/account-data";

const btnSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-bg-card px-3.5 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-muted/60 focus:outline-none focus:ring-2 focus:ring-input-focus disabled:opacity-50";

const labelClass = "flex cursor-pointer items-start gap-2 text-sm text-text-primary";
const MAX_ACCOUNT_IMPORT_BODY_MB = Math.floor(
  MAX_ACCOUNT_IMPORT_BODY_BYTES / (1024 * 1024)
);
const TARGET_CHUNK_BYTES = 450 * 1024;

export function AccountDataPortability({ className }: { className?: string }) {
  const { update } = useSession();
  const router = useRouter();
  const t = useTranslations("account");
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [restoreMode, setRestoreMode] = useState(true);
  const [applyProfile, setApplyProfile] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [chunkProgressPct, setChunkProgressPct] = useState<number | null>(null);

  function chunkCheckResultsBySize(items: unknown[]): unknown[][] {
    const chunks: unknown[][] = [];
    let current: unknown[] = [];
    let currentSize = 2;
    for (const item of items) {
      const row = JSON.stringify(item);
      const rowSize = row.length + 1;
      if (current.length > 0 && currentSize + rowSize > TARGET_CHUNK_BYTES) {
        chunks.push(current);
        current = [];
        currentSize = 2;
      }
      current.push(item);
      currentSize += rowSize;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  async function importChunkedRestore(
    obj: Record<string, unknown>
  ): Promise<{
    monitorsImported: number;
    checkResultsImported: number;
    monitorErrors: { index: number; error: string }[];
    checkErrors: { index: number; error: string }[];
    profileUpdated: boolean;
  }> {
    const checkResults = Array.isArray(obj.checkResults) ? obj.checkResults : [];
    const chunks = chunkCheckResultsBySize(checkResults);
    const monitorErrors: { index: number; error: string }[] = [];
    const checkErrors: { index: number; error: string }[] = [];
    let monitorsImported = 0;
    let checkResultsImported = 0;
    let profileUpdated = false;

    setImportStatus(t("dataPreparingRestore"));
    setChunkProgressPct(5);
    const initRes = await fetch("/api/user/account-import/chunked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upgAccountExportVersion: obj.upgAccountExportVersion,
        upgsAccountExportVersion: obj.upgsAccountExportVersion,
        stage: "init",
        applyProfile,
        user: obj.user,
        monitors: obj.monitors,
      }),
    });
    const initData = (await initRes.json().catch(() => ({}))) as {
      error?: string;
      monitorsImported?: number;
      monitorErrors?: { index: number; error: string }[];
      profileUpdated?: boolean;
    };
    if (!initRes.ok) throw new Error(initData.error ?? t("dataChunkedInitFailed"));
    monitorsImported = initData.monitorsImported ?? 0;
    if (initData.monitorErrors?.length) monitorErrors.push(...initData.monitorErrors);
    profileUpdated = initData.profileUpdated === true;

    for (let i = 0; i < chunks.length; i++) {
      const pct = 10 + Math.round(((i + 1) / Math.max(chunks.length, 1)) * 80);
      setImportStatus(t("dataImportingChunk", { current: i + 1, total: chunks.length }));
      setChunkProgressPct(pct);
      const checksRes = await fetch("/api/user/account-import/chunked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upgAccountExportVersion: obj.upgAccountExportVersion,
          upgsAccountExportVersion: obj.upgsAccountExportVersion,
          stage: "checks",
          checkResults: chunks[i],
        }),
      });
      const checksData = (await checksRes.json().catch(() => ({}))) as {
        error?: string;
        checkResultsImported?: number;
        checkErrors?: { index: number; error: string }[];
      };
      if (!checksRes.ok) throw new Error(checksData.error ?? t("dataChunkedChecksFailed"));
      checkResultsImported += checksData.checkResultsImported ?? 0;
      if (checksData.checkErrors?.length) checkErrors.push(...checksData.checkErrors);
    }

    setImportStatus(t("dataFinalizing"));
    setChunkProgressPct(95);
    const finalizeRes = await fetch("/api/user/account-import/chunked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upgAccountExportVersion: obj.upgAccountExportVersion,
        upgsAccountExportVersion: obj.upgsAccountExportVersion,
        stage: "finalize",
      }),
    });
    const finalizeData = (await finalizeRes.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!finalizeRes.ok) {
      throw new Error(finalizeData.error ?? t("dataChunkedFinalizeFailed"));
    }
    setChunkProgressPct(100);
    return {
      monitorsImported,
      checkResultsImported,
      monitorErrors,
      checkErrors,
      profileUpdated,
    };
  }

  async function handleExport() {
    setExporting(true);
    try {
      const q = includeHistory ? "" : "?includeCheckResults=false";
      const res = await fetch(`/api/user/account-export${q}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("dataExportFailed"));
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "upg-account.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("dataDownloadStarted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dataExportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportStatus(t("dataReadingFile"));
    setChunkProgressPct(null);
    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new Error(t("dataInvalidJson"));
      }
      if (json === null || typeof json !== "object") {
        throw new Error(t("dataInvalidExport"));
      }
      const body = {
        ...(json as Record<string, unknown>),
        replaceExistingMonitors: restoreMode,
        applyProfile,
      };
      let data: {
        error?: string;
        monitorsImported?: number;
        checkResultsImported?: number;
        monitorErrors?: { index: number; error: string }[];
        checkErrors?: { index: number; error: string }[];
        note?: string;
        profileUpdated?: boolean;
      };
      const res = await fetch("/api/user/account-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = (await res.json().catch(() => ({}))) as typeof data;
      if (!res.ok && res.status === 413 && restoreMode) {
        toast.info(t("dataLargeBackup"));
        data = await importChunkedRestore(json as Record<string, unknown>);
      } else if (!res.ok) {
        throw new Error(data.error ?? t("dataImportFailed"));
      }
      const parts: string[] = [];
      if (typeof data.monitorsImported === "number") {
        parts.push(t("dataMonitorCount", { count: data.monitorsImported }));
      }
      if (typeof data.checkResultsImported === "number" && data.checkResultsImported > 0) {
        parts.push(t("dataCheckCount", { count: data.checkResultsImported }));
      }
      toast.success(t("dataImportedParts", { parts: parts.join(", ") }));
      if (data.note) toast.info(data.note);
      if (data.monitorErrors?.length) {
        toast.info(t("dataMonitorRowsSkipped", { count: data.monitorErrors.length }));
      }
      if (data.checkErrors?.length) {
        toast.info(t("dataCheckRowsSkipped", { count: data.checkErrors.length }));
      }
      if (data.profileUpdated) {
        await update();
      }
      router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dataImportFailed"));
    } finally {
      setImportStatus(null);
      setChunkProgressPct(null);
      setImporting(false);
    }
  }

  return (
    <div className={cn("mt-10", className)}>
      <h2
        className="text-base font-semibold text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("dataTitle")}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">
        {t("dataSubtitle")}
      </p>

      <div className="mt-4 space-y-4 rounded-lg border border-border bg-bg-card px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("dataExportSection")}
          </p>
          <label className={`${labelClass} mt-3`}>
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-input-focus"
            />
            <span className="text-text-muted">
              {t("dataIncludeHistory")}
            </span>
          </label>
          <Button
            type="button"
            variant="outline"
            className={`${btnSecondaryClass} mt-4`}
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            <Download className="size-4 shrink-0" aria-hidden />
            {exporting ? t("dataPreparing") : t("dataDownloadJson")}
          </Button>
        </div>

        <hr className="border-border" />

        <div className="relative">
          {importing ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-bg-card/85 backdrop-blur-[1px]">
              <div className="w-full max-w-sm rounded-md border border-border bg-bg-card p-4 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("dataImportingBackup")}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {importStatus ?? t("dataImportingBackupDesc")}
                </p>
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-muted"
                  role="status"
                  aria-live="polite"
                  aria-label={t("dataImportInProgress")}
                >
                  <div
                    className="h-full animate-pulse rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${chunkProgressPct ?? 33}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("dataImportSection")}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {t("dataImportDescription")}
          </p>
          <label className={`${labelClass} mt-3`}>
            <input
              type="checkbox"
              checked={restoreMode}
              onChange={(e) => setRestoreMode(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-input-focus"
            />
            <span>
              <span className="text-text-primary">{t("dataRestoreMode")}</span>
              <span className="text-text-muted">
                {" "}{t("dataRestoreModeDesc")}
              </span>
            </span>
          </label>
          <label className={`${labelClass} mt-2`}>
            <input
              type="checkbox"
              checked={applyProfile}
              onChange={(e) => setApplyProfile(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-input-focus"
            />
            <span className="text-text-muted">
              {t("dataApplyProfile")}
            </span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="mt-4 block w-full text-sm text-text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-bg-card file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
            }}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <Upload className="size-3.5 shrink-0" aria-hidden />
            {t("dataFileStartsImport", { max: MAX_ACCOUNT_IMPORT_BODY_MB })}
          </p>
        </div>
      </div>
    </div>
  );
}
