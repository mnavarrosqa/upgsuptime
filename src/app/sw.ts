import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // App Router client navigations must hit the network. Caching RSC
    // payloads makes <Link> appear to do nothing until a full reload.
    {
      matcher: ({ request, url }) =>
        request.headers.get("RSC") === "1" || url.searchParams.has("_rsc"),
      handler: new NetworkOnly(),
    },
    // API responses are live account data (and exports can be many MB): never
    // cache them. The default rule stores them, which fails on large downloads.
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ─── Notification clicks ───────────────────────────────────────────────────────
// Alerts are shown by the open app (src/lib/browser-notifications.ts) through
// this registration; clicking one focuses the app and opens the monitor.

/** Only same-origin paths can be opened from a notification. */
function notificationPath(url: unknown): string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = notificationPath((event.notification.data as { url?: unknown } | null)?.url);
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
