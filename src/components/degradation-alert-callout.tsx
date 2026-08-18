"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { toast } from "sonner";
import {
  clearDegradationCalloutDismissed,
  clearGlobalDegradationDeferHint,
  dismissDegradationCalloutForMonitor,
  isDegradationCalloutDismissed,
} from "@/lib/degradation-callout-dismiss";

export function DegradationAlertCallout({
  monitorId,
  hasEmailAlerts,
}: {
  monitorId: string;
  hasEmailAlerts: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("degradationCallout");
  const [enabling, setEnabling] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);

  useEffect(() => {
    if (isDegradationCalloutDismissed(monitorId)) {
      setUserDismissed(true);
    }
  }, [monitorId]);

  async function handleEnable() {
    setEnabling(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ degradationAlertEnabled: true }),
      });
      if (!res.ok) {
        toast.error(t("errorToast"));
        return;
      }
      clearDegradationCalloutDismissed(monitorId);
      clearGlobalDegradationDeferHint();
      router.refresh();
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setEnabling(false);
    }
  }

  function handleLater() {
    dismissDegradationCalloutForMonitor(monitorId);
    setUserDismissed(true);
  }

  if (userDismissed) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-status-warn/25 bg-status-warn/[0.08] p-5"
      aria-label={t("title")}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("title")}
          </h2>
          <p className="mt-1.5 text-sm text-text-muted">
            {t("description")}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {t("details")}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {hasEmailAlerts ? (
              <>
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={enabling}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
                >
                  {enabling && <Spinner size="sm" />}
                  {enabling ? t("enabling") : t("enableButton")}
                </button>
                <button
                  type="button"
                  onClick={handleLater}
                  disabled={enabling}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-page disabled:opacity-60"
                >
                  {t("laterButton")}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-text-muted sm:max-w-[28rem]">
                  {t("requiresEmail")}
                </p>
                <button
                  type="button"
                  onClick={handleLater}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-page"
                >
                  {t("laterButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
