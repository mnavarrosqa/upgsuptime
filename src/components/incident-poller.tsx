"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useActivity } from "@/components/activity-context";

const POLL_INTERVAL_MS = 60_000;

interface Incident {
  id: string;
  name: string;
  url: string;
  lastStatusChangedAt: string | null;
}

export function IncidentPoller() {
  const lastCheckedRef = useRef<number | null>(null);
  const { addUnread, removeUnread } = useActivity();
  const addUnreadRef = useRef(addUnread);
  const removeUnreadRef = useRef(removeUnread);

  useEffect(() => {
    addUnreadRef.current = addUnread;
    removeUnreadRef.current = removeUnread;
  }, [addUnread, removeUnread]);

  useEffect(() => {
    lastCheckedRef.current = Date.now();

    async function poll() {
      const since = lastCheckedRef.current ?? 0;
      lastCheckedRef.current = Date.now();

      try {
        const res = await fetch(`/api/monitors/incidents?since=${since}`);
        if (!res.ok) return;
        const data: { incidents: Incident[] } = await res.json();
        for (const incident of data.incidents) {
          addUnreadRef.current(incident.id);
          toast.error(
            <span>
              <strong>{incident.name}</strong> is down —{" "}
              <Link
                href={`/monitors/${incident.id}`}
                className="underline"
                onClick={() => {
                  removeUnreadRef.current(incident.id);
                  toast.dismiss();
                }}
              >
                View monitor
              </Link>
            </span>,
            { duration: 10_000 }
          );
        }
      } catch {
        // silently ignore network errors
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
