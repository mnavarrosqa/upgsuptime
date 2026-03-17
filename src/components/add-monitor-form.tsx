"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

export function AddMonitorForm({
  onSuccess,
  onCancel,
  onBack,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
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
        setError(data.error ?? "Failed to add monitor");
        return;
      }
      setName("");
      setUrl("");
      setIntervalMinutes(5);
      setTimeoutSeconds(15);
      setMethod("GET");
      setExpectedStatusCodes("200-299");
      setAlertEmail(false);
      setAlertEmailTo("");
      setSslMonitoring(false);
      setShowOnStatusPage(true);
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
          {error}
        </div>
      )}

      <div>
        <label htmlFor="add-name" className={labelClass}>
          Name
        </label>
        <input
          id="add-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My API"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="add-url" className={labelClass}>
          URL
        </label>
        <input
          id="add-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className={inputClass}
        />
        <p className={hintClass}>Must be a valid HTTP or HTTPS URL.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="add-interval" className={labelClass}>
            Interval (min)
          </label>
          <input
            id="add-interval"
            type="number"
            min={1}
            max={60}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="add-method" className={labelClass}>
            Method
          </label>
          <select
            id="add-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")}
            className={inputClass}
          >
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
        <div>
          <label htmlFor="add-timeout" className={labelClass}>
            Timeout (sec)
          </label>
          <input
            id="add-timeout"
            type="number"
            min={5}
            max={120}
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(Number(e.target.value) || 15)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="add-expectedCodes" className={labelClass}>
            Status codes
          </label>
          <input
            id="add-expectedCodes"
            type="text"
            value={expectedStatusCodes}
            onChange={(e) => setExpectedStatusCodes(e.target.value)}
            placeholder="200-299"
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">Notifications</p>
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
            <label htmlFor="add-alertEmailTo" className={labelClass}>
              Alert email <span className="font-normal text-text-muted">(leave blank to use account email)</span>
            </label>
            <input
              id="add-alertEmailTo"
              type="email"
              value={alertEmailTo}
              onChange={(e) => setAlertEmailTo(e.target.value)}
              placeholder="alerts@example.com"
              className={inputClass}
            />
          </div>
        )}
      </div>

      {url.startsWith("https://") && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">SSL monitoring</p>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={sslMonitoring}
              onChange={(e) => setSslMonitoring(e.target.checked)}
              className="h-4 w-4 rounded border-input-border accent-accent"
            />
            <span className="text-sm text-text-primary">Monitor SSL certificate</span>
          </label>
          {sslMonitoring && (
            <p className="mt-2 text-xs text-text-muted">
              Checks cert validity and expiry on every run. Alerts fire when the cert becomes invalid or has ≤30 days left.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">Status page</p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={showOnStatusPage}
            onChange={(e) => setShowOnStatusPage(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">Show on public status page</span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          When enabled, this monitor appears at{" "}
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
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? "Adding…" : "Add monitor"}
        </button>
      </div>
    </form>
  );
}
