"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/spinner";
import { toast } from "sonner";

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
      router.refresh();
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setEnabling(false);
    }
  }

  return (
    <section
      className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-900/10"
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

      <div className="mt-4">
        {hasEmailAlerts ? (
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="inline-flex items-center gap-2 rounded-md bg-amber-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            {enabling && <Spinner size="sm" />}
            {enabling ? t("enabling") : t("enableButton")}
          </button>
        ) : (
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
            {t("requiresEmail")}
          </p>
        )}
      </div>
    </section>
  );
}
