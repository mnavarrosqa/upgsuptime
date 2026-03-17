"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { validateMonitorUrl } from "@/lib/validate-monitor";

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

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
  const [urlsText, setUrlsText] = useState("");
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

  const urls = urlsText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const validCount = urls.filter((url) => !validateMonitorUrl(url)).length;
  const invalidCount = urls.length - validCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = urlsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      setError("Enter at least one URL.");
      return;
    }

    const invalidDetails: Array<{ index: number; url: string; error: string }> = [];
    for (let i = 0; i < parsed.length; i++) {
      const err = validateMonitorUrl(parsed[i]);
      if (err) invalidDetails.push({ index: i + 1, url: parsed[i], error: err });
    }
    if (invalidDetails.length > 0) {
      setError(
        invalidDetails
          .map((d) => `Row ${d.index}: ${d.error}`)
          .join(" ")
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: parsed,
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
      setUrlsText("");
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

      <div>
        <label htmlFor="bulk-urls" className={labelClass}>
          URLs
        </label>
        <textarea
          id="bulk-urls"
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="https://example.com"
          rows={5}
          className={`${inputClass} min-h-[120px] resize-y`}
          aria-describedby="bulk-urls-hint"
        />
        <p id="bulk-urls-hint" className={hintClass}>
          One URL per line (up to 100). Names will be derived from each URL’s hostname.
        </p>
        {urls.length > 0 && (
          <p className={hintClass}>
            {urls.length} URL{urls.length !== 1 ? "s" : ""}
            {invalidCount > 0
              ? ` (${invalidCount} invalid — fix before adding)`
              : " — ready to add"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          disabled={
            submitting || urls.length === 0 || invalidCount > 0
          }
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting
            ? "Adding…"
            : urls.length > 0
              ? `Add ${urls.length} monitor${urls.length !== 1 ? "s" : ""}`
              : "Add monitors"}
        </button>
      </div>
    </form>
  );
}
