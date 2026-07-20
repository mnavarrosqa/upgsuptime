"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { NotificationsPanel } from "@/components/notifications-panel";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  "h-9 w-full min-w-0 rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

const selectClass = inputClass;

const textareaClass = `${inputClass} min-h-[96px] resize-y`;

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
  onDirtyChange,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const tBulk = useTranslations("bulkEdit");
  const tForm = useTranslations("monitorForm");
  const tCommon = useTranslations("common");

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

  const isDirty =
    rows.length > 0 ||
    pasteText.trim().length > 0 ||
    intervalMinutes !== 5 ||
    timeoutSeconds !== 15 ||
    method !== "GET" ||
    expectedStatusCodes !== "200-299" ||
    alertEmail ||
    alertEmailTo.trim().length > 0 ||
    sslMonitoring ||
    showOnStatusPage !== true;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
        urlError: url ? validateMonitorUrl(url) : tBulk("urlRequired"),
        nameError: validateMonitorName(name),
      };
    });
  // tBulk is stable, no need to include in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const allValid =
    rows.length > 0 &&
    rowIssues.every((i) => i.urlError === null && i.nameError === null);

  const setRowsFromParsed = useCallback((parsed: { name: string; url: string }[]) => {
    if (parsed.length === 0) {
      setError(tBulk("noSitesFound"));
      setRows([]);
      return;
    }
    if (parsed.length > MAX_SITES) {
      setError(tBulk("tooManySites", { found: parsed.length, max: MAX_SITES }));
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
  // tBulk is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(err instanceof Error ? err.message : tBulk("couldNotReadFile"));
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
      setError(tBulk("fixRowErrors"));
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
                  tBulk("rowError", { index: d.index, error: d.error })
              )
              .join("\n")
          );
        } else {
          setError(data.error ?? tBulk("failedToAddMonitors"));
        }
        return;
      }
      const count = data.created ?? items.length;
      toast.success(tBulk("monitorsAdded", { count }));
      setRows([]);
      setPasteText("");
      router.refresh();
      onSuccess?.();
    } catch {
      setError(tCommon("somethingWentWrong"));
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
        <p className={labelClass}>{tBulk("importFromFile")}</p>
        <p className={hintClass}>
          {tBulk("importFileHint", { max: MAX_SITES })}
        </p>
        <div className="mt-3">
          <p className="text-xs font-medium text-text-muted">
            {tBulk("sampleFormat")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={downloadSampleCsv}
              disabled={parsingFile || submitting}
              className="rounded-md border-border bg-bg-page px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated"
            >
              {tBulk("downloadCsvSample")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadSampleXlsx()}
              disabled={parsingFile || submitting}
              className="rounded-md border-border bg-bg-page px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated"
            >
              {tBulk("downloadXlsxSample")}
            </Button>
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
          <Label
            htmlFor={fileInputId}
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-border bg-bg-page px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-page/80",
              parsingFile || submitting
                ? "pointer-events-none cursor-not-allowed opacity-60"
                : "cursor-pointer"
            )}
          >
            {parsingFile ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {tBulk("readingFile")}
              </>
            ) : (
              tBulk("chooseFile")
            )}
          </Label>
          <span className="text-xs text-text-muted">
            {parsingFile ? "" : tBulk("fileTypes")}
          </span>
        </div>
      </div>

      <div>
        <Label htmlFor="bulk-paste" className={labelClass}>
          {tBulk("pasteListLabel")}
        </Label>
        <textarea
          id="bulk-paste"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="https://example.com"
          rows={4}
          className={textareaClass}
          aria-describedby="bulk-paste-hint"
        />
        <p id="bulk-paste-hint" className={hintClass}>
          {tBulk("pasteListHint")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={loadFromPaste}
          disabled={
            submitting || parsingFile || !pasteText.trim()
          }
          className="mt-2 rounded-md border-border bg-bg-page px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated"
        >
          {tBulk("loadIntoPreview")}
        </Button>
      </div>

      {rows.length > 0 && (
        <div>
          <p className={labelClass}>
            {allValid
              ? tBulk("sitesToAdd", { count: rows.length })
              : tBulk("sitesToAddWithErrors", { count: rows.length })}
          </p>
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg-page">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium text-text-primary">#</th>
                  <th className="px-3 py-2 font-medium text-text-primary">
                    {tForm("name")}
                  </th>
                  <th className="px-3 py-2 font-medium text-text-primary">
                    {tForm("url")}
                  </th>
                  <th className="px-3 py-2 font-medium text-text-primary w-24">
                    <span className="sr-only">{tBulk("colRemove")}</span>
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
                        <Input
                          type="text"
                          value={r.name}
                          onChange={(e) =>
                            updateRow(r.id, { name: e.target.value })
                          }
                          aria-invalid={nameBad}
                          className={cn(
                            inputClass,
                            nameBad && "border-red-400 dark:border-red-600"
                          )}
                          placeholder={deriveMonitorNameFromUrl(r.url.trim())}
                        />
                        {nameBad && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {issues.nameError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          type="url"
                          value={r.url}
                          onChange={(e) =>
                            updateRow(r.id, { url: e.target.value })
                          }
                          aria-invalid={urlBad}
                          className={cn(
                            inputClass,
                            urlBad && "border-red-400 dark:border-red-600"
                          )}
                          placeholder="https://"
                        />
                        {urlBad && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {issues.urlError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeRow(r.id)}
                          disabled={submitting}
                          className="rounded-md px-2 text-sm text-text-muted hover:bg-transparent hover:text-red-600 dark:hover:text-red-400"
                        >
                          {tBulk("colRemove")}
                        </Button>
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
          <Label htmlFor="bulk-interval" className={labelClass}>
            {tForm("intervalMinutes")}
          </Label>
          <Input
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
          <Label htmlFor="bulk-method" className={labelClass}>
            {tForm("method")}
          </Label>
          <select
            id="bulk-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")}
            className={selectClass}
          >
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
        <div>
          <Label htmlFor="bulk-timeout" className={labelClass}>
            {tForm("timeoutSeconds")}
          </Label>
          <Input
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
          <Label htmlFor="bulk-expectedCodes" className={labelClass}>
            {tForm("statusCodes")}
          </Label>
          <Input
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
          {tForm("notifications")}
        </p>
        <NotificationsPanel>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={alertEmail}
            onChange={(e) => setAlertEmail(e.target.checked)}
            className="ui-checkbox"
          />
          <span className="text-sm text-text-primary">{tForm("sendEmailAlerts")}</span>
        </label>
        {alertEmail && (
          <div>
            <Label htmlFor="bulk-alertEmailTo" className={labelClass}>
              {tForm("alertEmail")}{" "}
              <span className="font-normal text-text-muted">
                {tForm("useAccountEmailHint")}
              </span>
            </Label>
            <Input
              id="bulk-alertEmailTo"
              type="email"
              value={alertEmailTo}
              onChange={(e) => setAlertEmailTo(e.target.value)}
              placeholder="alerts@example.com"
              className={inputClass}
            />
          </div>
        )}
        </NotificationsPanel>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          {tForm("sslMonitoring")}
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={sslMonitoring}
            onChange={(e) => setSslMonitoring(e.target.checked)}
            className="ui-checkbox"
          />
          <span className="text-sm text-text-primary">
            {tForm("monitorSslCertificate")}
          </span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          {tBulk("sslHint")}
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          {tForm("statusPage")}
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={showOnStatusPage}
            onChange={(e) => setShowOnStatusPage(e.target.checked)}
            className="ui-checkbox"
          />
          <span className="text-sm text-text-primary">
            {tForm("showOnPublicStatusPage")}
          </span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          {tBulk("statusPageAtHint")}{" "}
          <span className="font-mono">/status/[your-username]</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
            className="mr-auto rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
          >
            {tForm("back")}
          </Button>
        )}
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page"
          >
            {tForm("cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || !allValid}
          variant="default"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting
            ? tForm("saving")
            : rows.length > 0
              ? tBulk("saveCount", { count: rows.length })
              : tBulk("saveMonitors")}
        </Button>
      </div>
    </form>
  );
}
