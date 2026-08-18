"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/spinner";
import { toast } from "sonner";
import {
  clearDegradationCalloutDismissed,
  clearGlobalDegradationDeferHint,
  dismissDegradationCalloutForMonitor,
  isDegradationCalloutDismissed,
} from "@/lib/degradation-callout-dismiss";
import { statusWarnCalloutClass } from "@/lib/monitor-ui";

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
      className={`rounded-xl p-5 ${statusWarnCalloutClass}`}
      aria-label={t("title")}
    >
      <h2 className="text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-status-warn-fg/90">
        {t("description")}
      </p>
      <p className="mt-2 text-sm text-status-warn-fg/80">
        {t("details")}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {hasEmailAlerts ? (
          <>
            <button
              type="button"
              onClick={handleEnable}
              disabled={enabling}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
            >
              {enabling && <Spinner size="sm" />}
              {enabling ? t("enabling") : t("enableButton")}
            </button>
            <button
              type="button"
              onClick={handleLater}
              disabled={enabling}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-muted disabled:opacity-60"
            >
              {t("laterButton")}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-sm text-status-warn-fg/90 sm:max-w-[28rem]">
              {t("requiresEmail")}
            </p>
            <button
              type="button"
              onClick={handleLater}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-muted"
            >
              {t("laterButton")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
