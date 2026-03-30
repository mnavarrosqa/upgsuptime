"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { deriveMonitorNameFromUrl } from "@/lib/derive-monitor-name";
import {
  parseSitesFromFile,
  parseSitesFromPlainText,
  parseSitesFromCsvString,
  splitCsvLine,
} from "@/lib/parse-site-file";
import {
  validateMonitorName,
  validateMonitorUrl,
} from "@/lib/validate-monitor";

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

const MAX_SITES = 100;

type PreviewRow = { id: string; name: string; url: string };

function newRowId(): string {
  return crypto.randomUUID();
}

function parsePastedList(text: string) {
  const first = text.split(/\r?\n/)[0] ?? "";
  if (first.includes(",") && splitCsvLine(first).length >= 2) {
    return parseSitesFromCsvString(text);
  }
  return parseSitesFromPlainText(text);
}

export function AddBulkMonitorsForm({
  onSuccess,
  onCancel,
  onBack,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
}) {
  const router = useRouter();
  const fileInputId = useId();

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [parsingFile, setParsingFile] = useState(false);

  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [timeoutSeconds, setTimeoutSeconds] = useState(15);
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [expectedStatusCodes, setExpectedStatusCodes] = useState("200-299");
  const [alertEmail, setAlertEmail] = useState(false);
  const [alertEmailTo, setAlertEmailTo] = useState("");
  const [sslMonitoring, setSslMonitoring] = useState(false);
  const [showOnStatusPage, setShowOnStatusPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadTextFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSampleCsv() {
    const content = [
      "name,url",
      "My API,https://api.example.com",
      "Homepage,https://example.com",
    ].join("\n");
    downloadTextFile(
      "upgs-uptime-sites-sample.csv",
      content,
      "text/csv;charset=utf-8"
    );
  }

  async function downloadSampleXlsx() {
    const XLSX = await import("xlsx");
    const aoa = [
      ["name", "url"],
      ["My API", "https://api.example.com"],
      ["Homepage", "https://example.com"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sites");
    const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "upgs-uptime-sites-sample.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const rowIssues = useMemo(() => {
    return rows.map((r) => {
      const url = r.url.trim();
      const name = r.name.trim() || deriveMonitorNameFromUrl(url);
      return {
        urlError: url ? validateMonitorUrl(url) : "URL is required",
        nameError: validateMonitorName(name),
      };
    });
  }, [rows]);

  const allValid =
    rows.length > 0 &&
    rowIssues.every((i) => i.urlError === null && i.nameError === null);

  const setRowsFromParsed = useCallback((parsed: { name: string; url: string }[]) => {
    if (parsed.length === 0) {
      setError("No sites found in that file or list.");
      setRows([]);
      return;
    }
    if (parsed.length > MAX_SITES) {
      setError(
        `Found ${parsed.length} sites; only the first ${MAX_SITES} are loaded.`
      );
    } else {
      setError(null);
    }
    setRows(
      parsed.slice(0, MAX_SITES).map((p) => ({
        id: newRowId(),
        name: p.name,
        url: p.url,
      }))
    );
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setParsingFile(true);
    try {
      const parsed = await parseSitesFromFile(file);
      setRowsFromParsed(parsed);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not read file");
    } finally {
      setParsingFile(false);
    }
  }

  function loadFromPaste() {
    setError(null);
    const parsed = parsePastedList(pasteText);
    setRowsFromParsed(parsed);
  }

  function updateRow(id: string, patch: Partial<Pick<PreviewRow, "name" | "url">>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!allValid) {
      setError("Fix or remove rows with errors before saving.");
      return;
    }

    const items = rows.map((r) => {
      const url = r.url.trim();
      const name = r.name.trim() || deriveMonitorNameFromUrl(url);
      return { url, name };
    });

    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          intervalMinutes,
          timeoutSeconds,
          method,
          expectedStatusCodes: expectedStatusCodes.trim() || "200-299",
          alertEmail,
          alertEmailTo: alertEmailTo.trim() || null,
          sslMonitoring,
          showOnStatusPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setError(
            data.details
              .map(
                (d: { index: number; url: string; error: string }) =>
                  `Row ${d.index}: ${d.error}`
              )
              .join("\n")
          );
        } else {
          setError(data.error ?? "Failed to add monitors");
        }
        return;
      }
      const count = data.created ?? items.length;
      toast.success(`${count} monitor${count !== 1 ? "s" : ""} added`);
      setRows([]);
      setPasteText("");
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          {error.includes("\n") ? (
            <ul className="list-inside list-disc space-y-0.5">
              {error.split("\n").map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            error
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-bg-elevated/30 p-4">
        <p className={labelClass}>Import from file</p>
        <p className={hintClass}>
          .txt (one URL per line), .csv, or .xlsx with columns{" "}
          <span className="font-mono">name</span> and{" "}
          <span className="font-mono">url</span>, or URL only. Up to{" "}
          {MAX_SITES} sites.
        </p>
        <div className="mt-3">
          <p className="text-xs font-medium text-text-muted">
            Sample format (recommended)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadSampleCsv}
              disabled={parsingFile || submitting}
              className="rounded-md border border-border bg-bg-page px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated disabled:opacity-60"
            >
              Download CSV sample
            </button>
            <button
              type="button"
              onClick={() => downloadSampleXlsx()}
              disabled={parsingFile || submitting}
              className="rounded-md border border-border bg-bg-page px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated disabled:opacity-60"
            >
              Download XLSX sample
            </button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-bg-page px-3 py-2 text-xs text-text-primary font-mono">
            name,url{"\n"}
            My API,https://api.example.com{"\n"}
            Homepage,https://example.com
          </pre>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id={fileInputId}
            type="file"
            accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={onFileChange}
            disabled={parsingFile || submitting}
          />
          <label
            htmlFor={fileInputId}
            className={`inline-flex items-center justify-center rounded-md border border-border bg-bg-page px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-page/80 ${
              parsingFile || submitting
                ? "pointer-events-none cursor-not-allowed opacity-60"
                : "cursor-pointer"
            }`}
          >
            {parsingFile ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Reading…
              </>
            ) : (
              "Choose file"
            )}
          </label>
          <span className="text-xs text-text-muted">
            {parsingFile ? "" : "txt, csv, xlsx"}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="bulk-paste" className={labelClass}>
          Or paste a list
        </label>
        <textarea
          id="bulk-paste"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="https://example.com"
          rows={4}
          className={`${inputClass} min-h-[96px] resize-y`}
          aria-describedby="bulk-paste-hint"
        />
        <p id="bulk-paste-hint" className={hintClass}>
          One URL per line, or CSV / spreadsheet-style rows. Load into the
          preview below.
        </p>
        <button
          type="button"
          onClick={loadFromPaste}
          disabled={
            submitting || parsingFile || !pasteText.trim()
          }
          className="mt-2 rounded-md border border-border bg-bg-page px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated disabled:opacity-60"
        >
          Load into preview
        </button>
      </div>

      {rows.length > 0 && (
        <div>
          <p className={labelClass}>
            Sites to add ({rows.length}
            {allValid ? "" : " — fix errors before saving"})
          </p>
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg-page">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium text-text-primary">#</th>
                  <th className="px-3 py-2 font-medium text-text-primary">
                    Name
                  </th>
                  <th className="px-3 py-2 font-medium text-text-primary">
                    URL
                  </th>
                  <th className="px-3 py-2 font-medium text-text-primary w-24">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const issues = rowIssues[idx];
                  const urlBad = issues?.urlError !== null;
                  const nameBad = issues?.nameError !== null;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 align-top text-text-muted">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) =>
                            updateRow(r.id, { name: e.target.value })
                          }
                          aria-invalid={nameBad}
                          className={`${inputClass} ${nameBad ? "border-red-400 dark:border-red-600" : ""}`}
                          placeholder={deriveMonitorNameFromUrl(r.url.trim())}
                        />
                        {nameBad && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {issues.nameError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="url"
                          value={r.url}
                          onChange={(e) =>
                            updateRow(r.id, { url: e.target.value })
                          }
                          aria-invalid={urlBad}
                          className={`${inputClass} ${urlBad ? "border-red-400 dark:border-red-600" : ""}`}
                          placeholder="https://"
                        />
                        {urlBad && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {issues.urlError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => removeRow(r.id)}
                          disabled={submitting}
                          className="rounded-md text-sm text-text-muted hover:text-red-600 dark:hover:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="bulk-interval" className={labelClass}>
            Interval (min)
          </label>
          <input
            id="bulk-interval"
            type="number"
            min={1}
            max={60}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bulk-method" className={labelClass}>
            Method
          </label>
          <select
            id="bulk-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")}
            className={inputClass}
          >
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
        <div>
          <label htmlFor="bulk-timeout" className={labelClass}>
            Timeout (sec)
          </label>
          <input
            id="bulk-timeout"
            type="number"
            min={5}
            max={120}
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(Number(e.target.value) || 15)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bulk-expectedCodes" className={labelClass}>
            Status codes
          </label>
          <input
            id="bulk-expectedCodes"
            type="text"
            value={expectedStatusCodes}
            onChange={(e) => setExpectedStatusCodes(e.target.value)}
            placeholder="200-299"
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          Notifications
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={alertEmail}
            onChange={(e) => setAlertEmail(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">Send email alerts</span>
        </label>
        {alertEmail && (
          <div className="mt-3">
            <label htmlFor="bulk-alertEmailTo" className={labelClass}>
              Alert email{" "}
              <span className="font-normal text-text-muted">
                (leave blank to use account email)
              </span>
            </label>
            <input
              id="bulk-alertEmailTo"
              type="email"
              value={alertEmailTo}
              onChange={(e) => setAlertEmailTo(e.target.value)}
              placeholder="alerts@example.com"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          SSL monitoring
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={sslMonitoring}
            onChange={(e) => setSslMonitoring(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">
            Monitor SSL certificate
          </span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          Applied to HTTPS URLs. Checks cert validity and expiry on every run.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          Status page
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={showOnStatusPage}
            onChange={(e) => setShowOnStatusPage(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">
            Show on public status page
          </span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          When enabled, these monitors appear at{" "}
          <span className="font-mono">/status/[your-username]</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="mr-auto rounded-md text-sm font-medium text-text-muted hover:text-text-primary"
          >
            Back
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !allValid}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting
            ? "Saving…"
            : rows.length > 0
              ? `Save ${rows.length} monitor${rows.length !== 1 ? "s" : ""}`
              : "Save monitors"}
        </button>
      </div>
    </form>
  );
}
