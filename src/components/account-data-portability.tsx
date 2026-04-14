"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function AccountDataPortability({ className }: { className?: string }) {
  const { update } = useSession();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [restoreMode, setRestoreMode] = useState(true);
  const [applyProfile, setApplyProfile] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const q = includeHistory ? "" : "?includeCheckResults=false";
      const res = await fetch(`/api/user/account-export${q}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Export failed");
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
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      if (file.size > MAX_ACCOUNT_IMPORT_BODY_BYTES) {
        throw new Error(
          `Import file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is ${MAX_ACCOUNT_IMPORT_BODY_MB}MB. Export again without check history for smaller files.`
        );
      }
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new Error("File is not valid JSON");
      }
      if (json === null || typeof json !== "object") {
        throw new Error("Invalid export file");
      }
      const body = {
        ...(json as Record<string, unknown>),
        replaceExistingMonitors: restoreMode,
        applyProfile,
      };
      const res = await fetch("/api/user/account-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        monitorsImported?: number;
        checkResultsImported?: number;
        monitorErrors?: { index: number; error: string }[];
        checkErrors?: { index: number; error: string }[];
        note?: string;
        profileUpdated?: boolean;
      };
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error(
            "Import file exceeds server upload limit. Export again without check history, or increase upload body size on your reverse proxy."
          );
        }
        throw new Error(data.error ?? "Import failed");
      }
      const parts: string[] = [];
      if (typeof data.monitorsImported === "number") {
        parts.push(`${data.monitorsImported} monitor(s)`);
      }
      if (typeof data.checkResultsImported === "number" && data.checkResultsImported > 0) {
        parts.push(`${data.checkResultsImported} check record(s)`);
      }
      toast.success(`Imported ${parts.join(", ")}`);
      if (data.note) toast.info(data.note);
      if (data.monitorErrors?.length) {
        toast.info(
          `${data.monitorErrors.length} monitor row(s) skipped (see server response for details)`
        );
      }
      if (data.checkErrors?.length) {
        toast.info(`${data.checkErrors.length} check result row(s) skipped`);
      }
      if (data.profileUpdated) {
        await update();
      }
      router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={cn("mt-10", className)}>
      <h2
        className="text-base font-semibold text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your data
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">
        Download everything tied to your account (profile, monitors, and
        optional check history), or restore from a backup file. Passwords are
        never included in exports.
      </p>

      <div className="mt-4 space-y-4 rounded-lg border border-border bg-bg-card px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Export
          </p>
          <label className={`${labelClass} mt-3`}>
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-input-focus"
            />
            <span className="text-text-muted">
              Include check history (larger file; uncheck for settings-only
              backup)
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
            {exporting ? "Preparing…" : "Download JSON"}
          </Button>
        </div>

        <hr className="border-border" />

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Import
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Use a file from this app&apos;s account export. Restore replaces
            all your monitors and their history; append adds monitors only and
            ignores history in the file.
          </p>
          <label className={`${labelClass} mt-3`}>
            <input
              type="checkbox"
              checked={restoreMode}
              onChange={(e) => setRestoreMode(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-input-focus"
            />
            <span>
              <span className="text-text-primary">Restore mode</span>
              <span className="text-text-muted">
                {" "}
                — replace all monitors and import check history from the file
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
              Also apply username and onboarding state from the file (email in
              the file is ignored)
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
          {importing ? (
            <div className="mt-3 rounded-md border border-border bg-bg-muted/40 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Importing backup...
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Uploading and applying your data. Keep this tab open until it finishes.
              </p>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-card"
                role="status"
                aria-live="polite"
                aria-label="Import in progress"
              >
                <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          ) : null}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <Upload className="size-3.5 shrink-0" aria-hidden />
            Choosing a file starts the import immediately (max {MAX_ACCOUNT_IMPORT_BODY_MB}MB).
          </p>
        </div>
      </div>
    </div>
  );
}
