"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Monitor } from "@/db/schema";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearDegradationCalloutDismissed,
  isDegradationCalloutDismissed,
} from "@/lib/degradation-callout-dismiss";
import { DNS_RECORD_TYPES } from "@/lib/validate-monitor";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

const selectClass = inputClass;

const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

function toDatetimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function EditMonitorForm({
  monitor,
  onSuccess,
  onCancel,
}: {
  monitor: Monitor;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const tDegradationHint = useTranslations("degradationFormHint");
  const tMonitorTypes = useTranslations("monitorTypes");
  const tForm = useTranslations("monitorForm");
  const tCommon = useTranslations("common");

  // Type is read-only after creation
  const monitorType = (monitor.type ?? "http") as "http" | "keyword" | "dns" | "tcp";

  const [name, setName] = useState(monitor.name);
  const [url, setUrl] = useState(monitor.url);
  const [intervalMinutes, setIntervalMinutes] = useState(monitor.intervalMinutes);
  const [alertEmail, setAlertEmail] = useState(!!monitor.alertEmail);
  const [alertEmailTo, setAlertEmailTo] = useState(monitor.alertEmailTo ?? "");
  const [showOnStatusPage, setShowOnStatusPage] = useState(
    monitor.showOnStatusPage !== false
  );

  // HTTP / keyword fields
  const [timeoutSeconds, setTimeoutSeconds] = useState(monitor.timeoutSeconds ?? 15);
  const [method, setMethod] = useState<"GET" | "HEAD" | "POST" | "PUT" | "PATCH">(
    ["GET", "HEAD", "POST", "PUT", "PATCH"].includes(monitor.method) ? monitor.method : "GET"
  );
  const [expectedStatusCodes, setExpectedStatusCodes] = useState(
    monitor.expectedStatusCodes ?? "200-299"
  );
  const [sslMonitoring, setSslMonitoring] = useState(!!monitor.sslMonitoring);
  const [requestHeaders, setRequestHeaders] = useState(monitor.requestHeaders ?? "[]");
  const [requestBody, setRequestBody] = useState(monitor.requestBody ?? "");
  const [requestBodyType, setRequestBodyType] = useState<"none" | "text" | "json" | "form">(
    monitor.requestBodyType ?? "none"
  );
  const [followRedirects, setFollowRedirects] = useState(monitor.followRedirects !== false);
  const [maxRedirects, setMaxRedirects] = useState(monitor.maxRedirects ?? 20);

  // Keyword-specific
  const [keywordContains, setKeywordContains] = useState(monitor.keywordContains ?? "");
  const [keywordShouldExist, setKeywordShouldExist] = useState(
    monitor.keywordShouldExist !== false
  );

  // DNS-specific
  const [dnsRecordType, setDnsRecordType] = useState(monitor.dnsRecordType ?? "A");
  const [dnsExpectedValue, setDnsExpectedValue] = useState(monitor.dnsExpectedValue ?? "");
  const [tcpPort, setTcpPort] = useState(monitor.tcpPort ?? 443);
  const [maintenanceStartsAt, setMaintenanceStartsAt] = useState(
    toDatetimeLocal(monitor.maintenanceStartsAt)
  );
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState(
    toDatetimeLocal(monitor.maintenanceEndsAt)
  );
  const [maintenanceNote, setMaintenanceNote] = useState(monitor.maintenanceNote ?? "");

  const [degradationAlertEnabled, setDegradationAlertEnabled] = useState(
    !!monitor.degradationAlertEnabled
  );

  const [showDegradationDeferHint, setShowDegradationDeferHint] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDns = monitorType === "dns";
  const isKeyword = monitorType === "keyword";
  const isTcp = monitorType === "tcp";

  useEffect(() => {
    setShowDegradationDeferHint(
      !isDns &&
        !isTcp &&
        !monitor.degradationAlertEnabled &&
        isDegradationCalloutDismissed(monitor.id)
    );
  }, [isDns, isTcp, monitor.degradationAlertEnabled, monitor.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const bodyObj: Record<string, unknown> = {
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

      if (isKeyword) {
        bodyObj.keywordContains = keywordContains;
        bodyObj.keywordShouldExist = keywordShouldExist;
      }

      if (isDns) {
        bodyObj.dnsRecordType = dnsRecordType;
        bodyObj.dnsExpectedValue = dnsExpectedValue;
      }

      if (isTcp) {
        bodyObj.tcpHost = url;
        bodyObj.tcpPort = tcpPort;
      }

      bodyObj.maintenanceStartsAt = maintenanceStartsAt || null;
      bodyObj.maintenanceEndsAt = maintenanceEndsAt || null;
      bodyObj.maintenanceNote = maintenanceNote.trim() || null;

      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tForm("updateFailed"));
        return;
      }
      if (!isDns && !isTcp && degradationAlertEnabled) {
        clearDegradationCalloutDismissed(monitor.id);
        setShowDegradationDeferHint(false);
      }
      toast.success(tForm("updateSuccess"));
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
          {error}
        </div>
      )}

      {/* Monitor type — read-only */}
      <div>
        <p className={labelClass}>{tMonitorTypes("typeLabel")}</p>
        <p className="rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-muted">
          {tMonitorTypes(monitorType)}
        </p>
        <p className={hintClass}>{tMonitorTypes("typeReadOnly")}</p>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="edit-name" className={labelClass}>
          {tForm("name")}
        </Label>
        <Input
          id="edit-name"
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
        <Label htmlFor="edit-url" className={labelClass}>
          {isDns || isTcp ? tMonitorTypes("hostnameLabel") : tForm("url")}
        </Label>
        <Input
          id="edit-url"
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
          <Label htmlFor="edit-interval" className={labelClass}>
            {tForm("intervalMinutes")}
          </Label>
          <Input
            id="edit-interval"
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
            <Label htmlFor="edit-interval" className={labelClass}>
              {tForm("intervalMinutes")}
            </Label>
            <Input
              id="edit-interval"
              type="number"
              min={1}
              max={60}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="edit-timeout" className={labelClass}>
              {tForm("timeoutSeconds")}
            </Label>
            <Input
              id="edit-timeout"
              type="number"
              min={5}
              max={120}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value) || 15)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="edit-tcp-port" className={labelClass}>
              {tForm("port")}
            </Label>
            <Input
              id="edit-tcp-port"
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
            <Label htmlFor="edit-interval" className={labelClass}>
              {tForm("intervalMinutes")}
            </Label>
            <Input
              id="edit-interval"
              type="number"
              min={1}
              max={60}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="edit-method" className={labelClass}>
              {tForm("method")}
            </Label>
            <select
              id="edit-method"
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
            <Label htmlFor="edit-timeout" className={labelClass}>
              {tForm("timeoutSeconds")}
            </Label>
            <Input
              id="edit-timeout"
              type="number"
              min={5}
              max={120}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value) || 15)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="edit-expectedCodes" className={labelClass}>
              {tForm("statusCodes")}
            </Label>
            <Input
              id="edit-expectedCodes"
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
              <Label htmlFor="edit-request-headers" className={labelClass}>
                {tForm("headersJson")}
              </Label>
              <textarea
                id="edit-request-headers"
                value={requestHeaders}
                onChange={(e) => setRequestHeaders(e.target.value)}
                placeholder={'[{"name":"Authorization","value":"Bearer token"}]'}
                className={`${inputClass} min-h-24 resize-y font-mono`}
              />
              <p className={hintClass}>{tForm("headersRedactedHint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="edit-body-type" className={labelClass}>
                  {tForm("bodyType")}
                </Label>
                <select
                  id="edit-body-type"
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
                <Label htmlFor="edit-max-redirects" className={labelClass}>
                  {tForm("maxRedirects")}
                </Label>
                <Input
                  id="edit-max-redirects"
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
                <Label htmlFor="edit-request-body" className={labelClass}>
                  {tForm("requestBody")}
                </Label>
                <textarea
                  id="edit-request-body"
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
            <Label htmlFor="edit-keyword" className={labelClass}>
              {tMonitorTypes("keywordLabel")}
            </Label>
            <Input
              id="edit-keyword"
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
                name="edit-keywordMode"
                checked={keywordShouldExist}
                onChange={() => setKeywordShouldExist(true)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-text-primary">{tMonitorTypes("keywordShouldContain")}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="edit-keywordMode"
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
              <Label htmlFor="edit-dns-record-type" className={labelClass}>
                {tMonitorTypes("dnsRecordTypeLabel")}
              </Label>
              <select
                id="edit-dns-record-type"
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
              <Label htmlFor="edit-dns-expected" className={labelClass}>
                {tMonitorTypes("dnsExpectedValueLabel")}
              </Label>
              <Input
                id="edit-dns-expected"
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
            <Label htmlFor="edit-alertEmailTo" className={labelClass}>
              {tForm("alertEmail")} <span className="font-normal text-text-muted">{tForm("useAccountEmailHint")}</span>
            </Label>
            <Input
              id="edit-alertEmailTo"
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
            {tDegradationHint("editReminder")}
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
            <Label htmlFor="edit-maintenance-start" className={labelClass}>
              {tForm("starts")}
            </Label>
            <Input
              id="edit-maintenance-start"
              type="datetime-local"
              value={maintenanceStartsAt}
              onChange={(e) => setMaintenanceStartsAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="edit-maintenance-end" className={labelClass}>
              {tForm("ends")}
            </Label>
            <Input
              id="edit-maintenance-end"
              type="datetime-local"
              value={maintenanceEndsAt}
              onChange={(e) => setMaintenanceEndsAt(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="edit-maintenance-note" className={labelClass}>
            {tForm("note")}
          </Label>
          <Input
            id="edit-maintenance-note"
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

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
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
          {submitting ? tForm("saving") : tForm("saveChanges")}
        </Button>
      </div>
    </form>
  );
}
