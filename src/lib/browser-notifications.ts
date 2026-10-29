/**
 * System notifications shown by the open app (the browser's Notification API,
 * no push service). They appear while the app is open in any tab or as an
 * installed PWA, including in the background.
 */

const PREF_KEY = "upg-browser-notifications";

export type BrowserNotificationState = "unsupported" | "denied" | "off" | "on";

function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function prefOn(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

export function getBrowserNotificationState(): BrowserNotificationState {
  if (!browserNotificationsSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && prefOn() ? "on" : "off";
}

/** Asks for permission if needed and remembers the choice for this browser. */
export async function enableBrowserNotifications(): Promise<BrowserNotificationState> {
  if (!browserNotificationsSupported()) return "unsupported";
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  try {
    window.localStorage.setItem(PREF_KEY, "on");
  } catch {
    // Storage unavailable: notifications still work for this page view.
  }
  return "on";
}

export function disableBrowserNotifications(): void {
  try {
    window.localStorage.removeItem(PREF_KEY);
  } catch {
    // ignore
  }
}

export type AppNotification = {
  title: string;
  body: string;
  /** Same tag replaces the previous notification (one per monitor). */
  tag: string;
  /** Same-origin path to open on click. */
  url: string;
};

/**
 * Shows a system notification. Uses the service worker when there is one
 * (required on Android, and its click handler opens `url`); otherwise falls
 * back to `new Notification`.
 */
export async function showBrowserNotification(notification: AppNotification): Promise<boolean> {
  if (getBrowserNotificationState() !== "on") return false;
  const options = {
    body: notification.body,
    tag: notification.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: notification.url },
    renotify: true,
  } as NotificationOptions;

  const registration =
    "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
  if (registration?.active) {
    await registration.showNotification(notification.title, options);
    return true;
  }
  const shown = new Notification(notification.title, options);
  shown.onclick = () => {
    window.focus();
    window.location.assign(notification.url);
    shown.close();
  };
  return true;
}
