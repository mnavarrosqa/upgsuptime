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
  const tMonitorTypes = useTranslations("monitorTypes");
  const tForm = useTranslations("monitorForm");
  const tCommon = useTranslations("common");
  const tMonitors = useTranslations("monitorsPage");

  // Monitor type
  const [monitorType, setMonitorType] = useState<"http" | "keyword" | "dns" | "tcp">("http");

  // Common fields
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [alertEmail, setAlertEmail] = useState(false);
  const [alertEmailTo, setAlertEmailTo] = useState("");
  const [showOnStatusPage, setShowOnStatusPage] = useState(true);

  // HTTP / keyword fields
  const [timeoutSeconds, setTimeoutSeconds] = useState(15);
  const [method, setMethod] = useState<"GET" | "HEAD" | "POST" | "PUT" | "PATCH">("GET");
  const [expectedStatusCodes, setExpectedStatusCodes] = useState("200-299");
  const [sslMonitoring, setSslMonitoring] = useState(false);
  const [requestHeaders, setRequestHeaders] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [requestBodyType, setRequestBodyType] = useState<"none" | "text" | "json" | "form">("none");
  const [followRedirects, setFollowRedirects] = useState(true);
  const [maxRedirects, setMaxRedirects] = useState(20);

  // Keyword-specific
  const [keywordContains, setKeywordContains] = useState("");
  const [keywordShouldExist, setKeywordShouldExist] = useState(true);

  // DNS-specific
  const [dnsRecordType, setDnsRecordType] = useState("A");
  const [dnsExpectedValue, setDnsExpectedValue] = useState("");

  // TCP-specific
  const [tcpPort, setTcpPort] = useState(443);

  // Scheduled maintenance
  const [maintenanceStartsAt, setMaintenanceStartsAt] = useState("");
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");

  const [degradationAlertEnabled, setDegradationAlertEnabled] = useState(false);

  const [showDegradationDeferHint, setShowDegradationDeferHint] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setShowDegradationDeferHint(isGlobalDegradationDeferHint());
  }, []);

  function handleTypeChange(newType: "http" | "keyword" | "dns" | "tcp") {
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
        if (!isTcp) {
          bodyObj.method = isKeyword ? "GET" : method;
          bodyObj.expectedStatusCodes = expectedStatusCodes.trim() || "200-299";
          bodyObj.sslMonitoring = sslMonitoring;
          bodyObj.degradationAlertEnabled = degradationAlertEnabled;
        }
      }

      if (monitorType === "http") {
        bodyObj.requestHeaders = requestHeaders.trim() || "[]";
        bodyObj.requestBody = requestBodyType === "none" ? null : requestBody;
        bodyObj.requestBodyType = requestBodyType;
        bodyObj.followRedirects = followRedirects;
        bodyObj.maxRedirects = maxRedirects;
      }

      if (monitorType === "keyword") {
        bodyObj.keywordContains = keywordContains;
        bodyObj.keywordShouldExist = keywordShouldExist;
      }

      if (monitorType === "dns") {
        bodyObj.dnsRecordType = dnsRecordType;
        bodyObj.dnsExpectedValue = dnsExpectedValue;
      }

      if (monitorType === "tcp") {
        bodyObj.tcpHost = url;
        bodyObj.tcpPort = tcpPort;
      }

      bodyObj.maintenanceStartsAt = maintenanceStartsAt || null;
      bodyObj.maintenanceEndsAt = maintenanceEndsAt || null;
      bodyObj.maintenanceNote = maintenanceNote.trim() || null;

      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tForm("addFailed"));
        return;
      }

      if (!isDns && !isTcp && degradationAlertEnabled) {
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
      setRequestHeaders("");
      setRequestBody("");
      setRequestBodyType("none");
      setFollowRedirects(true);
      setMaxRedirects(20);
      setAlertEmail(false);
      setAlertEmailTo("");
      setDegradationAlertEnabled(false);
      setSslMonitoring(false);
      setShowOnStatusPage(true);
      setKeywordContains("");
      setKeywordShouldExist(true);
      setDnsRecordType("A");
      setDnsExpectedValue("");
      setTcpPort(443);
      setMaintenanceStartsAt("");
      setMaintenanceEndsAt("");
      setMaintenanceNote("");

      toast.success(tForm("addSuccess"));
      router.refresh();
      onSuccess?.();
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  const isDns = monitorType === "dns";
  const isKeyword = monitorType === "keyword";
  const isTcp = monitorType === "tcp";

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
          {tMonitorTypes("typeLabel")}
        </Label>
        <select
          id="add-type"
          value={monitorType}
          onChange={(e) => handleTypeChange(e.target.value as "http" | "keyword" | "dns" | "tcp")}
          className={selectClass}
        >
          <option value="http">{tMonitorTypes("http")}</option>
          <option value="keyword">{tMonitorTypes("keyword")}</option>
          <option value="dns">{tMonitorTypes("dns")}</option>
          <option value="tcp">{tMonitorTypes("tcp")}</option>
        </select>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="add-name" className={labelClass}>
          {tForm("name")}
        </Label>
        <Input
          id="add-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tForm("namePlaceholder")}
          required
          className={inputClass}
        />
      </div>

      {/* URL / Hostname */}
      <div>
        <Label htmlFor="add-url" className={labelClass}>
          {isDns || isTcp ? tMonitorTypes("hostnameLabel") : tForm("url")}
        </Label>
        <Input
          id="add-url"
          type={isDns || isTcp ? "text" : "url"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={isDns || isTcp ? tMonitorTypes("hostnamePlaceholder") : "https://example.com"}
          required
          className={inputClass}
        />
        <p className={hintClass}>
          {isDns || isTcp
            ? tMonitorTypes("hostnameHint")
            : tForm("urlHint")}
        </p>
      </div>

      {/* Check options */}
      {isDns ? (
        <div>
          <Label htmlFor="add-interval" className={labelClass}>
            {tForm("intervalMinutes")}
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
      ) : isTcp ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="add-interval" className={labelClass}>
              {tForm("intervalMinutes")}
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
            <Label htmlFor="add-timeout" className={labelClass}>
              {tForm("timeoutSeconds")}
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
            <Label htmlFor="add-tcp-port" className={labelClass}>
              {tForm("port")}
            </Label>
            <Input
              id="add-tcp-port"
              type="number"
              min={1}
              max={65535}
              value={tcpPort}
              onChange={(e) => setTcpPort(Number(e.target.value) || 443)}
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="add-interval" className={labelClass}>
              {tForm("intervalMinutes")}
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
              {tForm("method")}
            </Label>
            <select
              id="add-method"
              value={isKeyword ? "GET" : method}
              onChange={(e) => setMethod(e.target.value as "GET" | "HEAD" | "POST" | "PUT" | "PATCH")}
              disabled={isKeyword}
              className={selectClass}
            >
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
            {isKeyword && (
              <p className={hintClass}>{tMonitorTypes("methodLockedToGet")}</p>
            )}
          </div>
          <div>
            <Label htmlFor="add-timeout" className={labelClass}>
              {tForm("timeoutSeconds")}
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
              {tForm("statusCodes")}
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

      {monitorType === "http" && (
        <details className="rounded-md border border-border bg-bg-page px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-text-primary">
            {tForm("advancedRequestSettings")}
          </summary>
          <div className="mt-3 grid gap-3">
            <div>
              <Label htmlFor="add-request-headers" className={labelClass}>
                {tForm("headersJson")}
              </Label>
              <textarea
                id="add-request-headers"
                value={requestHeaders}
                onChange={(e) => setRequestHeaders(e.target.value)}
                placeholder={'[{"name":"Authorization","value":"Bearer token"}]'}
                className={`${inputClass} min-h-24 resize-y font-mono`}
              />
              <p className={hintClass}>{tForm("headersRedactedHint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="add-body-type" className={labelClass}>
                  {tForm("bodyType")}
                </Label>
                <select
                  id="add-body-type"
                  value={requestBodyType}
                  onChange={(e) => setRequestBodyType(e.target.value as "none" | "text" | "json" | "form")}
                  disabled={method === "GET" || method === "HEAD"}
                  className={selectClass}
                >
                  <option value="none">{tForm("bodyTypeNone")}</option>
                  <option value="text">{tForm("bodyTypeText")}</option>
                  <option value="json">JSON</option>
                  <option value="form">{tForm("bodyTypeForm")}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="add-max-redirects" className={labelClass}>
                  {tForm("maxRedirects")}
                </Label>
                <Input
                  id="add-max-redirects"
                  type="number"
                  min={0}
                  max={20}
                  value={maxRedirects}
                  onChange={(e) => setMaxRedirects(Number(e.target.value) || 0)}
                  disabled={!followRedirects}
                  className={inputClass}
                />
              </div>
              <label className="mt-7 flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={(e) => setFollowRedirects(e.target.checked)}
                  className="h-4 w-4 rounded border-input-border accent-accent"
                />
                <span className="text-sm text-text-primary">{tForm("followRedirects")}</span>
              </label>
            </div>
            {requestBodyType !== "none" && method !== "GET" && method !== "HEAD" && (
              <div>
                <Label htmlFor="add-request-body" className={labelClass}>
                  {tForm("requestBody")}
                </Label>
                <textarea
                  id="add-request-body"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className={`${inputClass} min-h-28 resize-y font-mono`}
                />
              </div>
            )}
          </div>
        </details>
      )}

      {/* Keyword section */}
      {isKeyword && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">{tMonitorTypes("keywordSectionTitle")}</p>
          <div>
            <Label htmlFor="add-keyword" className={labelClass}>
              {tMonitorTypes("keywordLabel")}
            </Label>
            <Input
              id="add-keyword"
              type="text"
              value={keywordContains}
              onChange={(e) => setKeywordContains(e.target.value)}
              placeholder={tForm("keywordPlaceholder")}
              required
              className={inputClass}
            />
            <p className={hintClass}>{tMonitorTypes("keywordHint")}</p>
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
              <span className="text-sm text-text-primary">{tMonitorTypes("keywordShouldContain")}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="add-keywordMode"
                checked={!keywordShouldExist}
                onChange={() => setKeywordShouldExist(false)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-text-primary">{tMonitorTypes("keywordShouldNotContain")}</span>
            </label>
          </div>
        </div>
      )}

      {/* DNS section */}
      {isDns && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">{tMonitorTypes("dnsSectionTitle")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="add-dns-record-type" className={labelClass}>
                {tMonitorTypes("dnsRecordTypeLabel")}
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
                {tMonitorTypes("dnsExpectedValueLabel")}
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
                  ? tMonitorTypes("dnsExpectedHintSubstring")
                  : tMonitorTypes("dnsExpectedHintExact")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">{tForm("notifications")}</p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={alertEmail}
            onChange={(e) => setAlertEmail(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">{tForm("sendEmailAlerts")}</span>
        </label>
        {alertEmail && (
          <div className="mt-3">
            <Label htmlFor="add-alertEmailTo" className={labelClass}>
              {tForm("alertEmail")} <span className="font-normal text-text-muted">{tForm("useAccountEmailHint")}</span>
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
        {!isDns && !isTcp && showDegradationDeferHint && (
          <div
            role="note"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950/90 dark:border-amber-800/40 dark:bg-amber-950/25 dark:text-amber-100/90"
          >
            {tDegradationHint("addReminder")}
          </div>
        )}
        {!isDns && !isTcp && (
          <div className="mt-3">
            <label className={`flex items-center gap-2.5 ${alertEmail ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input
                type="checkbox"
                checked={degradationAlertEnabled}
                onChange={(e) => setDegradationAlertEnabled(e.target.checked)}
                disabled={!alertEmail}
                className="h-4 w-4 rounded border-input-border accent-accent disabled:cursor-not-allowed"
              />
              <span className="text-sm text-text-primary">{tForm("slowResponseAlerts")}</span>
            </label>
            {degradationAlertEnabled && alertEmail && (
              <p className={hintClass}>
                {tForm("slowResponseAlertsHint")}
              </p>
            )}
            {!alertEmail && (
              <p className={hintClass}>{tForm("requiresEmailAlerts")}</p>
            )}
          </div>
        )}
      </div>

      {/* SSL monitoring — only for HTTP/keyword HTTPS */}
      {!isDns && !isTcp && url.startsWith("https://") && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">{tForm("sslMonitoring")}</p>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={sslMonitoring}
              onChange={(e) => setSslMonitoring(e.target.checked)}
              className="h-4 w-4 rounded border-input-border accent-accent"
            />
            <span className="text-sm text-text-primary">{tForm("monitorSslCertificate")}</span>
          </label>
          {sslMonitoring && (
            <p className="mt-2 text-xs text-text-muted">
              {tForm("sslMonitoringHint")}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">{tForm("maintenanceWindow")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="add-maintenance-start" className={labelClass}>
              {tForm("starts")}
            </Label>
            <Input
              id="add-maintenance-start"
              type="datetime-local"
              value={maintenanceStartsAt}
              onChange={(e) => setMaintenanceStartsAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="add-maintenance-end" className={labelClass}>
              {tForm("ends")}
            </Label>
            <Input
              id="add-maintenance-end"
              type="datetime-local"
              value={maintenanceEndsAt}
              onChange={(e) => setMaintenanceEndsAt(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="add-maintenance-note" className={labelClass}>
            {tForm("note")}
          </Label>
          <Input
            id="add-maintenance-note"
            type="text"
            value={maintenanceNote}
            onChange={(e) => setMaintenanceNote(e.target.value)}
            placeholder={tForm("maintenanceNotePlaceholder")}
            className={inputClass}
          />
          <p className={hintClass}>{tForm("maintenanceSuppressesAlerts")}</p>
        </div>
      </div>

      {/* Status page */}
      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">{tForm("statusPage")}</p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={showOnStatusPage}
            onChange={(e) => setShowOnStatusPage(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-accent"
          />
          <span className="text-sm text-text-primary">{tForm("showOnPublicStatusPage")}</span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          {tForm("statusPageHint")}{" "}
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
          disabled={submitting}
          variant="default"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? tForm("adding") : tMonitors("addMonitor")}
        </Button>
      </div>
    </form>
  );
}
