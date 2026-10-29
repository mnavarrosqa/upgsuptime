"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BellOff, BellRing, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  getBrowserNotificationState,
  showBrowserNotification,
  type BrowserNotificationState,
} from "@/lib/browser-notifications";

const UNAVAILABLE_COPY = {
  unsupported: { title: "unsupportedTitle", body: "unsupportedBody" },
  denied: { title: "deniedTitle", body: "deniedBody" },
} as const;

export function NotificationSettings() {
  const t = useTranslations("notifications");
  // null until mounted: permission and the saved choice only exist in the browser.
  const [state, setState] = useState<BrowserNotificationState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setState(getBrowserNotificationState());
    sync();
    // Permission can change from the browser's site settings while the page is open.
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const next = await enableBrowserNotifications();
      setState(next);
      if (next === "on") toast.success(t("enabledToast"));
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    disableBrowserNotifications();
    setState(getBrowserNotificationState());
    toast.success(t("disabledToast"));
  }

  async function sendTest() {
    const shown = await showBrowserNotification({
      title: t("testTitle"),
      body: t("testBody"),
      tag: "test",
      url: "/account#notifications",
    }).catch(() => false);
    if (!shown) toast.error(t("testFailed"));
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
        {t("title")}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">{t("subtitle")}</p>

      <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
        {state === null ? (
          <div className="flex justify-center py-2" aria-busy="true">
            <Spinner />
          </div>
        ) : state === "on" || state === "off" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {state === "on" ? (
                <BellRing className="mt-0.5 size-5 shrink-0 text-status-up" aria-hidden />
              ) : (
                <BellOff className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{state === "on" ? t("onTitle") : t("offTitle")}</p>
                <p className="mt-0.5 text-sm text-text-muted">{state === "on" ? t("onBody") : t("offBody")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {state === "on" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => void sendTest()}>
                    {t("sendTest")}
                  </Button>
                  <Button type="button" variant="outline" onClick={disable}>
                    {t("disable")}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => void enable()} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : null}
                  {t("enable")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t(UNAVAILABLE_COPY[state].title)}</p>
              <p className="mt-0.5 text-sm text-text-muted">{t(UNAVAILABLE_COPY[state].body)}</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-text-muted">{t("perBrowserNote")}</p>
    </div>
  );
}
