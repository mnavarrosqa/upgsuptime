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
      className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-900/10"
      aria-label={t("title")}
    >
      <h2 className="text-sm font-medium text-amber-800 dark:text-amber-400">
        {t("title")}
      </h2>
      <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-400/60">
        {t("description")}
      </p>
      <p className="mt-2 text-xs text-amber-700/70 dark:text-amber-400/60">
        {t("details")}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {hasEmailAlerts ? (
          <>
            <button
              type="button"
              onClick={handleEnable}
              disabled={enabling}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              {enabling && <Spinner size="sm" />}
              {enabling ? t("enabling") : t("enableButton")}
            </button>
            <button
              type="button"
              onClick={handleLater}
              disabled={enabling}
              className="inline-flex items-center justify-center rounded-md border border-amber-800/35 bg-transparent px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100/80 disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              {t("laterButton")}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70 sm:max-w-[28rem]">
              {t("requiresEmail")}
            </p>
            <button
              type="button"
              onClick={handleLater}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-800/35 bg-transparent px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100/80 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              {t("laterButton")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
