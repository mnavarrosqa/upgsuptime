"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";

const POLL_INTERVAL_MS = 60_000;

interface Incident {
  id: string;
  name: string;
  url: string;
  lastStatusChangedAt: string | null;
}

export function IncidentPoller() {
  const lastCheckedRef = useRef<number>(Date.now());

  useEffect(() => {
    async function poll() {
      const since = lastCheckedRef.current;
      lastCheckedRef.current = Date.now();

      try {
        const res = await fetch(`/api/monitors/incidents?since=${since}`);
        if (!res.ok) return;
        const data: { incidents: Incident[] } = await res.json();
        for (const incident of data.incidents) {
          toast.error(
            <span>
              <strong>{incident.name}</strong> is down —{" "}
              <Link
                href={`/monitors/${incident.id}`}
                className="underline"
                onClick={() => toast.dismiss()}
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
