"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActivity } from "@/components/activity-context";
import { showBrowserNotification } from "@/lib/browser-notifications";
import { diffStatuses, type MonitorStatusSnapshot, type StatusChange } from "@/lib/status-changes";

const POLL_INTERVAL_MS = 60_000;

/**
 * While the app is open, polls monitor statuses and announces outages and
 * recoveries: an in-app toast, plus a system notification when the app is in
 * the background and browser notifications are on.
 */
export function IncidentPoller() {
  const t = useTranslations("notifications");
  const { addUnread, removeUnread } = useActivity();
  const latest = useRef({ t, addUnread, removeUnread });

  useEffect(() => {
    latest.current = { t, addUnread, removeUnread };
  }, [t, addUnread, removeUnread]);

  useEffect(() => {
    let previous: Map<string, MonitorStatusSnapshot> | null = null;
    let stopped = false;

    function announce(change: StatusChange) {
      const { t, addUnread, removeUnread } = latest.current;
      const href = `/monitors/${change.id}`;
      const down = change.kind === "down";
      if (down) addUnread(change.id);

      const message = down ? t("downTitle", { name: change.name }) : t("recoveredTitle", { name: change.name });
      const show = down ? toast.error : toast.success;
      show(
        <span>
          <strong>{message}</strong>{" "}
          <Link
            href={href}
            className="underline"
            onClick={() => {
              removeUnread(change.id);
              toast.dismiss();
            }}
          >
            {t("viewMonitor")}
          </Link>
        </span>,
        { duration: 10_000 },
      );

      if (document.visibilityState !== "visible") {
        void showBrowserNotification({
          title: message,
          body: down ? t("downBody") : t("recoveredBody"),
          tag: `monitor-${change.id}`,
          url: href,
        }).catch(() => undefined);
      }
    }

    async function poll() {
      try {
        const res = await fetch("/api/monitors/statuses", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { monitors } = (await res.json()) as { monitors: MonitorStatusSnapshot[] };
        if (previous) diffStatuses(previous, monitors).forEach(announce);
        previous = new Map(monitors.map((m) => [m.id, m]));
      } catch {
        // Network hiccup: keep the last snapshot and try again next tick.
      }
    }

    void poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
