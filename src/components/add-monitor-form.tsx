"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearGlobalDegradationDeferHint,
  isGlobalDegradationDeferHint,
} from "@/lib/degradation-callout-dismiss";
import { DNS_RECORD_TYPES } from "@/lib/validate-monitor";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

const selectClass = inputClass;

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
  const tDegradationHint = useTranslations("degradationFormHint");

  // Monitor type
  const [monitorType, setMonitorType] = useState<"http" | "keyword" | "dns">("http");

  // Common fields
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [alertEmail, setAlertEmail] = useState(false);
  const [alertEmailTo, setAlertEmailTo] = useState("");
  const [showOnStatusPage, setShowOnStatusPage] = useState(true);

  // HTTP / keyword fields
  const [timeoutSeconds, setTimeoutSeconds] = useState(15);
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [expectedStatusCodes, setExpectedStatusCodes] = useState("200-299");
  const [sslMonitoring, setSslMonitoring] = useState(false);

  // Keyword-specific
  const [keywordContains, setKeywordContains] = useState("");
  const [keywordShouldExist, setKeywordShouldExist] = useState(true);

  // DNS-specific
  const [dnsRecordType, setDnsRecordType] = useState("A");
  const [dnsExpectedValue, setDnsExpectedValue] = useState("");

  const [degradationAlertEnabled, setDegradationAlertEnabled] = useState(false);

  const [showDegradationDeferHint, setShowDegradationDeferHint] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setShowDegradationDeferHint(isGlobalDegradationDeferHint());
  }, []);

  function handleTypeChange(newType: "http" | "keyword" | "dns") {
    setMonitorType(newType);
    // Reset URL when switching to/from DNS to avoid confusion
    setUrl("");
    setSslMonitoring(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const bodyObj: Record<string, unknown> = {
        type: monitorType,
        name,
        url,
        intervalMinutes,
        alertEmail,
        alertEmailTo: alertEmailTo.trim() || null,
        showOnStatusPage,
      };

      if (!isDns) {
        bodyObj.timeoutSeconds = timeoutSeconds;
        bodyObj.method = isKeyword ? "GET" : method;
        bodyObj.expectedStatusCodes = expectedStatusCodes.trim() || "200-299";
        bodyObj.sslMonitoring = sslMonitoring;
        bodyObj.degradationAlertEnabled = degradationAlertEnabled;
      }

      if (monitorType === "keyword") {
        bodyObj.keywordContains = keywordContains;
        bodyObj.keywordShouldExist = keywordShouldExist;
      }

      if (monitorType === "dns") {
        bodyObj.dnsRecordType = dnsRecordType;
        bodyObj.dnsExpectedValue = dnsExpectedValue;
      }

      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add monitor");
        return;
      }

      if (!isDns && degradationAlertEnabled) {
        clearGlobalDegradationDeferHint();
        setShowDegradationDeferHint(false);
      }

      // Reset all fields
      setName("");
      setUrl("");
      setIntervalMinutes(5);
      setTimeoutSeconds(15);
      setMethod("GET");
      setExpectedStatusCodes("200-299");
      setAlertEmail(false);
      setAlertEmailTo("");
      setDegradationAlertEnabled(false);
      setSslMonitoring(false);
      setShowOnStatusPage(true);
      setKeywordContains("");
      setKeywordShouldExist(true);
      setDnsRecordType("A");
      setDnsExpectedValue("");

      toast.success("Monitor added");
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const isDns = monitorType === "dns";
  const isKeyword = monitorType === "keyword";

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

      {/* Monitor type selector */}
      <div>
        <Label htmlFor="add-type" className={labelClass}>
          Monitor type
        </Label>
        <select
          id="add-type"
          value={monitorType}
          onChange={(e) => handleTypeChange(e.target.value as "http" | "keyword" | "dns")}
          className={selectClass}
        >
          <option value="http">HTTP – check status code</option>
          <option value="keyword">Keyword – check response body</option>
          <option value="dns">DNS – check record resolution</option>
        </select>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="add-name" className={labelClass}>
          Name
        </Label>
        <Input
          id="add-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My API"
          required
          className={inputClass}
        />
      </div>

      {/* URL / Hostname */}
      <div>
        <Label htmlFor="add-url" className={labelClass}>
          {isDns ? "Hostname" : "URL"}
        </Label>
        <Input
          id="add-url"
          type={isDns ? "text" : "url"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={isDns ? "example.com" : "https://example.com"}
          required
          className={inputClass}
        />
        <p className={hintClass}>
          {isDns
            ? "Enter a hostname without https://"
            : "Must be a valid HTTP or HTTPS URL."}
        </p>
      </div>

      {/* HTTP/Keyword options: interval + method + timeout + status codes */}
      {isDns ? (
        <div>
          <Label htmlFor="add-interval" className={labelClass}>
            Interval (min)
          </Label>
          <Input
            id="add-interval"
            type="number"
            min={1}
            max={60}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
            className={inputClass}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="add-interval" className={labelClass}>
              Interval (min)
            </Label>
            <Input
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
            <Label htmlFor="add-method" className={labelClass}>
              Method
            </Label>
            <select
              id="add-method"
              value={isKeyword ? "GET" : method}
              onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")}
              disabled={isKeyword}
              className={selectClass}
            >
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
            {isKeyword && (
              <p className={hintClass}>Keyword monitors always use GET.</p>
            )}
          </div>
          <div>
            <Label htmlFor="add-timeout" className={labelClass}>
              Timeout (sec)
            </Label>
            <Input
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
            <Label htmlFor="add-expectedCodes" className={labelClass}>
              Status codes
            </Label>
            <Input
              id="add-expectedCodes"
              type="text"
              value={expectedStatusCodes}
              onChange={(e) => setExpectedStatusCodes(e.target.value)}
              placeholder="200-299"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Keyword section */}
      {isKeyword && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">Keyword check</p>
          <div>
            <Label htmlFor="add-keyword" className={labelClass}>
              Keyword
            </Label>
            <Input
              id="add-keyword"
              type="text"
              value={keywordContains}
              onChange={(e) => setKeywordContains(e.target.value)}
              placeholder="expected text"
              required
              className={inputClass}
            />
            <p className={hintClass}>Case-insensitive search in response body (up to 2 MB read).</p>
          </div>
          <div className="mt-3 flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="add-keywordMode"
                checked={keywordShouldExist}
                onChange={() => setKeywordShouldExist(true)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-text-primary">Should contain</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="add-keywordMode"
                checked={!keywordShouldExist}
                onChange={() => setKeywordShouldExist(false)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-text-primary">Should not contain</span>
            </label>
          </div>
        </div>
      )}

      {/* DNS section */}
      {isDns && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">DNS check</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="add-dns-record-type" className={labelClass}>
                Record type
              </Label>
              <select
                id="add-dns-record-type"
                value={dnsRecordType}
                onChange={(e) => setDnsRecordType(e.target.value)}
                className={selectClass}
              >
                {DNS_RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="add-dns-expected" className={labelClass}>
                Expected value
              </Label>
              <Input
                id="add-dns-expected"
                type="text"
                value={dnsExpectedValue}
                onChange={(e) => setDnsExpectedValue(e.target.value)}
                placeholder={
                  dnsRecordType === "A"
                    ? "93.184.216.34"
                    : dnsRecordType === "MX"
                      ? "mail.example.com"
                      : dnsRecordType === "TXT"
                        ? "v=spf1"
                        : "value"
                }
                required
                className={inputClass}
              />
              <p className={hintClass}>
                {dnsRecordType === "TXT"
                  ? "Substring match (case-insensitive)"
                  : "Exact match (case-insensitive)"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
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
            <Label htmlFor="add-alertEmailTo" className={labelClass}>
              Alert email <span className="font-normal text-text-muted">(leave blank to use account email)</span>
            </Label>
            <Input
              id="add-alertEmailTo"
              type="email"
              value={alertEmailTo}
              onChange={(e) => setAlertEmailTo(e.target.value)}
              placeholder="alerts@example.com"
              className={inputClass}
            />
          </div>
        )}
        {!isDns && showDegradationDeferHint && (
          <div
            role="note"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950/90 dark:border-amber-800/40 dark:bg-amber-950/25 dark:text-amber-100/90"
          >
            {tDegradationHint("addReminder")}
          </div>
        )}
        {!isDns && (
          <div className="mt-3">
            <label className={`flex items-center gap-2.5 ${alertEmail ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input
                type="checkbox"
                checked={degradationAlertEnabled}
                onChange={(e) => setDegradationAlertEnabled(e.target.checked)}
                disabled={!alertEmail}
                className="h-4 w-4 rounded border-input-border accent-accent disabled:cursor-not-allowed"
              />
              <span className="text-sm text-text-primary">Alert on slow response times</span>
            </label>
            {degradationAlertEnabled && alertEmail && (
              <p className={hintClass}>
                Learns this site&apos;s normal response time over 20+ checks, then alerts when a sustained 2× slowdown is detected. Fires once per episode.
              </p>
            )}
            {!alertEmail && (
              <p className={hintClass}>Requires email alerts to be enabled.</p>
            )}
          </div>
        )}
      </div>

      {/* SSL monitoring — only for HTTP/keyword HTTPS */}
      {!isDns && url.startsWith("https://") && (
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

      {/* Status page */}
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
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
            className="mr-auto rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
          >
            Back
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
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting}
          variant="default"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? "Adding…" : "Add monitor"}
        </Button>
      </div>
    </form>
  );
}
