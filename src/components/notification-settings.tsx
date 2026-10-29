"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BellOff, BellRing, Info, Smartphone } from "lucide-react";
import { useApiErrorMessage, type ApiErrorPayload } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";

type State =
  | { kind: "loading" }
  | { kind: "server-disabled" }
  | { kind: "unsupported" }
  | { kind: "ios-install" }
  | { kind: "denied" }
  | { kind: "off"; registration: ServiceWorkerRegistration; publicKey: string }
  | { kind: "on"; registration: ServiceWorkerRegistration; publicKey: string; subscription: PushSubscription };

const SERVICE_WORKER_WAIT_MS = 4000;
const SUBSCRIBE_TIMEOUT_MS = 20_000;

const UNAVAILABLE_COPY = {
  "server-disabled": { title: "serverDisabledTitle", body: "serverDisabledBody" },
  unsupported: { title: "unsupportedTitle", body: "unsupportedBody" },
  "ios-install": { title: "iosInstallTitle", body: "iosInstallBody" },
  denied: { title: "deniedTitle", body: "deniedBody" },
} as const;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIosWithoutInstall(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** The app's service worker, or null when none becomes active (e.g. dev builds). */
async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SERVICE_WORKER_WAIT_MS));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Matches when the subscription was made with this server's current VAPID key. */
function usesKey(subscription: PushSubscription, publicKey: string): boolean {
  const key = subscription.options.applicationServerKey;
  if (!key) return true;
  const current = urlBase64ToUint8Array(publicKey);
  const existing = new Uint8Array(key);
  return existing.length === current.length && existing.every((b, i) => b === current[i]);
}

async function saveSubscription(subscription: PushSubscription): Promise<Response> {
  return fetch("/api/user/web-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

export function NotificationSettings() {
  const t = useTranslations("notifications");
  const apiErrorMessage = useApiErrorMessage();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async () => {
    const config = (await fetch("/api/user/web-push")
      .then((r) => r.json())
      .catch(() => null)) as { enabled?: boolean; publicKey?: string | null } | null;
    if (!config?.enabled || !config.publicKey) return setState({ kind: "server-disabled" });

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setState({ kind: isIosWithoutInstall() ? "ios-install" : "unsupported" });
    }
    if (Notification.permission === "denied") return setState({ kind: "denied" });

    const registration = await getServiceWorker();
    if (!registration) return setState({ kind: "unsupported" });

    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === "granted" && usesKey(subscription, config.publicKey)) {
      // Re-send so the server knows about it even if it dropped the row.
      void saveSubscription(subscription);
      return setState({ kind: "on", registration, publicKey: config.publicKey, subscription });
    }
    setState({ kind: "off", registration, publicKey: config.publicKey });
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  async function enable() {
    if (state.kind !== "off") return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "denied" } : state);
        return;
      }
      const stale = await state.registration.pushManager.getSubscription();
      if (stale) await stale.unsubscribe();
      // The browser registers with its push service here; don't spin forever if that never answers.
      const subscription = await Promise.race([
        state.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("Push subscription timed out")), SUBSCRIBE_TIMEOUT_MS),
        ),
      ]);
      const res = await saveSubscription(subscription);
      if (!res.ok) {
        await subscription.unsubscribe();
        toast.error(apiErrorMessage((await res.json().catch(() => ({}))) as ApiErrorPayload));
        return;
      }
      setState({ kind: "on", registration: state.registration, publicKey: state.publicKey, subscription });
      toast.success(t("enabledToast"));
    } catch (err) {
      console.error("[notifications] subscribe failed", err);
      toast.error(t("enableFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (state.kind !== "on") return;
    setBusy(true);
    try {
      const { endpoint } = state.subscription;
      await state.subscription.unsubscribe();
      await fetch("/api/user/web-push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setState({ kind: "off", registration: state.registration, publicKey: state.publicKey });
      toast.success(t("disabledToast"));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (state.kind !== "on") return;
    setBusy(true);
    try {
      const res = await fetch("/api/user/web-push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      });
      if (!res.ok) {
        toast.error(t("testFailed"));
        return;
      }
      toast.success(t("testSent"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
        {t("title")}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">{t("subtitle")}</p>

      <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
        {state.kind === "loading" ? (
          <div className="flex justify-center py-2" aria-busy="true">
            <Spinner />
          </div>
        ) : state.kind === "on" || state.kind === "off" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {state.kind === "on" ? (
                <BellRing className="mt-0.5 size-5 shrink-0 text-status-up" aria-hidden />
              ) : (
                <BellOff className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {state.kind === "on" ? t("onTitle") : t("offTitle")}
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {state.kind === "on" ? t("onBody") : t("offBody")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {state.kind === "on" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={busy}>
                    {t("sendTest")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void disable()} disabled={busy}>
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
            {state.kind === "ios-install" ? (
              <Smartphone className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t(UNAVAILABLE_COPY[state.kind].title)}</p>
              <p className="mt-0.5 text-sm text-text-muted">{t(UNAVAILABLE_COPY[state.kind].body)}</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-text-muted">{t("perBrowserNote")}</p>
    </div>
  );
}
