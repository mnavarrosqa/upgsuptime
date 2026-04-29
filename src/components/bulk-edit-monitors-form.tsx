"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Monitor } from "@/db/schema";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

const selectClass = inputClass;

const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

function allEqual<T>(values: T[]): boolean {
  if (values.length <= 1) return true;
  const first = values[0];
  return values.every((v) => v === first);
}

type TriBool = boolean | null;

export function BulkEditMonitorsForm({
  monitors,
  onSuccess,
  onCancel,
}: {
  monitors: Monitor[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const tForm = useTranslations("monitorForm");
  const tCommon = useTranslations("common");
  const tBulk = useTranslations("bulkEdit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervals = monitors.map((m) => m.intervalMinutes);
  const timeouts = monitors.map((m) => m.timeoutSeconds ?? 15);
  const methods = monitors.map((m) => (m.method === "HEAD" ? "HEAD" : "GET"));
  const codes = monitors.map((m) => m.expectedStatusCodes ?? "200-299");
  const alertEmails = monitors.map((m) => !!m.alertEmail);
  const alertTos = monitors.map((m) => (m.alertEmailTo ?? "").trim());
  const ssls = monitors.map((m) => !!m.sslMonitoring);
  const statusPages = monitors.map((m) => m.showOnStatusPage !== false);
  const httpLikeMonitors = monitors.filter((m) => m.type === "http" || m.type === "keyword");
  const degradations = httpLikeMonitors.map((m) => !!m.degradationAlertEnabled);

  const [intervalMinutes, setIntervalMinutes] = useState<string>(
    allEqual(intervals) ? String(intervals[0] ?? 5) : ""
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState<string>(
    allEqual(timeouts) ? String(timeouts[0] ?? 15) : ""
  );
  const [method, setMethod] = useState<"GET" | "HEAD" | "mixed">(
    allEqual(methods) ? (methods[0] as "GET" | "HEAD") : "mixed"
  );
  const [expectedStatusCodes, setExpectedStatusCodes] = useState<string>(
    allEqual(codes) ? codes[0] ?? "200-299" : ""
  );
  const [alertEmail, setAlertEmail] = useState<TriBool>(
    allEqual(alertEmails) ? alertEmails[0] : null
  );
  const [alertEmailTo, setAlertEmailTo] = useState<string>(
    allEqual(alertTos) ? alertTos[0] ?? "" : ""
  );
  const [sslMonitoring, setSslMonitoring] = useState<TriBool>(
    allEqual(ssls) ? ssls[0] : null
  );
  const [showOnStatusPage, setShowOnStatusPage] = useState<TriBool>(
    allEqual(statusPages) ? statusPages[0] : null
  );
  const [degradationAlertEnabled, setDegradationAlertEnabled] = useState<TriBool>(
    degradations.length > 0 && allEqual(degradations) ? degradations[0] : null
  );

  const alertEmailRef = useRef<HTMLInputElement>(null);
  const sslRef = useRef<HTMLInputElement>(null);
  const statusPageRef = useRef<HTMLInputElement>(null);
  const degradationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (alertEmailRef.current) {
      alertEmailRef.current.indeterminate = alertEmail === null;
    }
  }, [alertEmail]);

  useEffect(() => {
    if (sslRef.current) {
      sslRef.current.indeterminate = sslMonitoring === null;
    }
  }, [sslMonitoring]);

  useEffect(() => {
    if (statusPageRef.current) {
      statusPageRef.current.indeterminate = showOnStatusPage === null;
    }
  }, [showOnStatusPage]);

  useEffect(() => {
    if (degradationRef.current) {
      degradationRef.current.indeterminate = degradationAlertEnabled === null;
    }
  }, [degradationAlertEnabled]);

  const anyHttps = monitors.some((m) => m.url.startsWith("https://"));
  const anyHttpLike = httpLikeMonitors.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const patchBase: Record<string, unknown> = {};

    if (intervalMinutes.trim() !== "") {
      const n = Number(intervalMinutes);
      if (!Number.isFinite(n) || n < 1) {
        setError(tBulk("intervalInvalid"));
        return;
      }
      patchBase.intervalMinutes = Math.min(n, 60);
    }

    if (timeoutSeconds.trim() !== "") {
      const n = Number(timeoutSeconds);
      if (!Number.isFinite(n) || n < 5) {
        setError(tBulk("timeoutInvalid"));
        return;
      }
      patchBase.timeoutSeconds = Math.min(n, 120);
    }

    if (method !== "mixed") {
      patchBase.method = method;
    }

    if (expectedStatusCodes.trim() !== "") {
      patchBase.expectedStatusCodes =
        expectedStatusCodes.trim() || "200-299";
    }

    if (alertEmail !== null) {
      patchBase.alertEmail = alertEmail;
      patchBase.alertEmailTo = alertEmail
        ? alertEmailTo.trim() || null
        : null;
    }

    if (sslMonitoring !== null) {
      patchBase.sslMonitoring = sslMonitoring;
    }

    if (showOnStatusPage !== null) {
      patchBase.showOnStatusPage = showOnStatusPage;
    }

    if (degradationAlertEnabled !== null) {
      patchBase.degradationAlertEnabled = degradationAlertEnabled;
    }

    if (Object.keys(patchBase).length === 0) {
      setError(tBulk("noChanges"));
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        monitors.map((m) =>
          fetch(`/api/monitors/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: m.name,
              url: m.url,
              ...patchBase,
            }),
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data.error ?? tBulk("failedFor", { name: m.name }));
            }
            return data;
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected") as {
        status: "rejected";
        reason: unknown;
      }[];

      if (failed.length === 0) {
        toast.success(
          monitors.length === 1
            ? tForm("updateSuccess")
            : tBulk("updatedCount", { count: monitors.length })
        );
        router.refresh();
        onSuccess?.();
      } else if (failed.length === results.length) {
        const msg =
          failed[0].reason instanceof Error
            ? failed[0].reason.message
            : tForm("updateFailed");
        setError(msg);
      } else {
        toast.warning(
          tBulk("partialFailure", { updated: results.length - failed.length, failed: failed.length })
        );
        router.refresh();
        onSuccess?.();
      }
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

      <div className="rounded-md border border-border bg-bg-page p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {tBulk("selectedCount", { count: monitors.length })}
        </p>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm">
          {monitors.map((m) => (
            <li key={m.id} className="truncate text-text-primary">
              <span className="font-medium">{m.name}</span>
              <span className="ml-2 text-text-muted">{m.url}</span>
            </li>
          ))}
        </ul>
        <p className={hintClass}>
          {tBulk("scopeHint")}
        </p>
      </div>

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
            onChange={(e) => setIntervalMinutes(e.target.value)}
            placeholder={intervalMinutes === "" ? tBulk("various") : undefined}
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
            onChange={(e) =>
              setMethod(e.target.value as "GET" | "HEAD" | "mixed")
            }
            className={selectClass}
          >
            <option value="mixed">{tBulk("various")}</option>
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
            onChange={(e) => setTimeoutSeconds(e.target.value)}
            placeholder={timeoutSeconds === "" ? tBulk("various") : undefined}
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
            placeholder={
              expectedStatusCodes === "" ? tBulk("various") : "200-299"
            }
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          {tForm("notifications")}
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            ref={alertEmailRef}
            type="checkbox"
            checked={alertEmail === true}
            onChange={(e) => {
              setAlertEmail(e.target.checked);
            }}
            className="ui-checkbox"
          />
          <span className="text-sm text-text-primary">{tForm("sendEmailAlerts")}</span>
        </label>
        {alertEmail === true && (
          <div className="mt-3">
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
        {anyHttpLike && (
          <div className="mt-3">
            <label className={`flex items-center gap-2.5 ${alertEmail === true ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input
                ref={degradationRef}
                type="checkbox"
                checked={degradationAlertEnabled === true}
                onChange={(e) => setDegradationAlertEnabled(e.target.checked)}
                disabled={alertEmail !== true}
                className="ui-checkbox"
              />
              <span className="text-sm text-text-primary">{tForm("slowResponseAlerts")}</span>
            </label>
            {alertEmail !== true && (
              <p className={hintClass}>{tForm("requiresEmailAlerts")}</p>
            )}
            {degradationAlertEnabled === true && alertEmail === true && (
              <p className={hintClass}>
                {tBulk("slowResponseAlertsHint")}
              </p>
            )}
          </div>
        )}
      </div>

      {anyHttps && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-text-primary">
            {tForm("sslMonitoring")}
          </p>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              ref={sslRef}
              type="checkbox"
              checked={sslMonitoring === true}
              onChange={(e) => setSslMonitoring(e.target.checked)}
              className="ui-checkbox"
            />
            <span className="text-sm text-text-primary">
              {tForm("monitorSslCertificate")}
            </span>
          </label>
          {sslMonitoring === true && (
            <p className="mt-2 text-xs text-text-muted">
              {tBulk("sslBulkHint")}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-text-primary">
          {tForm("statusPage")}
        </p>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            ref={statusPageRef}
            type="checkbox"
            checked={showOnStatusPage === true}
            onChange={(e) => setShowOnStatusPage(e.target.checked)}
            className="ui-checkbox"
          />
          <span className="text-sm text-text-primary">
            {tForm("showOnPublicStatusPage")}
          </span>
        </label>
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
          {submitting ? tForm("saving") : tBulk("applyToAll")}
        </Button>
      </div>
    </form>
  );
}
