"use client";

import { Pause } from "lucide-react";
import { useTranslations } from "next-intl";

type MonitorStatusBadgeProps = {
  paused?: boolean | null;
  latest: { ok: boolean } | undefined;
};

export function MonitorStatusBadge({ paused, latest }: MonitorStatusBadgeProps) {
  const t = useTranslations("monitorsPage");
  if (paused) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-bg-page px-2 py-0.5 text-[11px] font-semibold text-text-muted">
        <Pause
          className="size-3 shrink-0 opacity-80"
          strokeWidth={2.25}
          aria-hidden
        />
        {t("statusPaused")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        latest?.ok
          ? "bg-status-up/10 text-status-up"
          : latest
            ? "bg-status-down/10 text-status-down"
            : "bg-bg-page text-text-muted"
      }`}
    >
      {latest?.ok ? (
        <span
          className="relative inline-flex size-2 shrink-0 items-center justify-center overflow-visible"
          aria-hidden
        >
          <span className="animate-monitor-status-ring absolute inline-flex size-2 rounded-full bg-status-up/40" />
          <span className="relative z-10 inline-flex size-2 rounded-full bg-status-up" />
        </span>
      ) : latest ? (
        <span
          className="relative inline-flex size-2 shrink-0 items-center justify-center overflow-visible"
          aria-hidden
        >
          <span className="animate-monitor-status-ring absolute inline-flex size-2 rounded-full bg-status-down/40" />
          <span className="relative z-10 inline-flex size-2 rounded-full bg-status-down" />
        </span>
      ) : null}
      {latest?.ok ? t("statusUp") : latest ? t("statusDown") : "—"}
    </span>
  );
}
