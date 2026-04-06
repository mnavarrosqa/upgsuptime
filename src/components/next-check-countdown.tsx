"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

function formatRemaining(remainingMs: number): string {
  const sec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CheckingAnimated({ label }: { label: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="text-text-primary">{label}</span>
      <span
        className="animate-checking-dots inline-flex min-w-[0.85em] select-none gap-px"
        aria-hidden
      >
        <span className="animate-checking-dot">.</span>
        <span className="animate-checking-dot">.</span>
        <span className="animate-checking-dot">.</span>
      </span>
    </span>
  );
}

export function NextCheckCountdown({
  monitorId,
  paused,
  lastCheckAtIso,
  intervalMinutes,
}: {
  monitorId: string;
  paused: boolean;
  lastCheckAtIso: string | null;
  intervalMinutes: number;
}) {
  const t = useTranslations("monitorDetail");
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (paused || !lastCheckAtIso) return null;
    const nextAt =
      new Date(lastCheckAtIso).getTime() + intervalMinutes * 60 * 1000;
    return nextAt - now;
  }, [paused, lastCheckAtIso, intervalMinutes, now]);

  const isAwaitingCheck =
    remainingMs !== null && remainingMs <= 0 && !!lastCheckAtIso;

  useEffect(() => {
    if (!isAwaitingCheck || !monitorId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/monitors/${monitorId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { lastCheckAt?: string | null };
        const apiMs = data.lastCheckAt
          ? new Date(data.lastCheckAt).getTime()
          : 0;
        const baselineMs = new Date(lastCheckAtIso!).getTime();
        if (apiMs > baselineMs) {
          router.refresh();
        }
      } catch {
        /* ignore transient network errors */
      }
    }

    void poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [isAwaitingCheck, monitorId, lastCheckAtIso, router]);

  if (paused) {
    return (
      <p className="mt-2 text-sm text-text-muted">{t("nextCheckPaused")}</p>
    );
  }

  if (!lastCheckAtIso) {
    return (
      <p className="mt-2 text-sm text-text-muted">{t("nextCheckPending")}</p>
    );
  }

  if (remainingMs !== null && remainingMs <= 0) {
    return (
      <p
        className="mt-2 text-sm text-text-muted"
        aria-busy="true"
        aria-live="polite"
      >
        <CheckingAnimated label={t("checking")} />
      </p>
    );
  }

  if (remainingMs === null) {
    return null;
  }

  return (
    <p className="mt-2 text-sm text-text-muted">
      <span className="tabular-nums text-text-primary">
        {t("nextCheckIn", { time: formatRemaining(remainingMs) })}
      </span>
    </p>
  );
}
