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
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-border px-2 py-0.5 text-xs font-medium text-text-muted">
        <Pause
          className="h-3 w-3 shrink-0 opacity-90"
          strokeWidth={2.25}
          aria-hidden
        />
        {t("statusPaused")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        latest?.ok
          ? "bg-status-up text-status-up-fg dark:bg-status-up-soft dark:text-status-up"
          : latest
            ? "bg-status-down text-status-down-fg dark:bg-status-down-soft dark:text-status-down"
            : "bg-border text-text-muted"
      }`}
    >
      {latest?.ok ? (
        <span
          className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center overflow-visible"
          aria-hidden
        >
          <span className="animate-monitor-status-ring absolute inline-flex h-2.5 w-2.5 rounded-full bg-status-up-fg/55 dark:bg-status-up/45" />
          <span className="relative z-10 inline-flex h-2.5 w-2.5 rounded-full bg-status-up-fg dark:bg-status-up" />
        </span>
      ) : latest ? (
        <span
          className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center overflow-visible"
          aria-hidden
        >
          <span className="animate-monitor-status-ring absolute inline-flex h-2.5 w-2.5 rounded-full bg-status-down-fg/55 dark:bg-status-down/45" />
          <span className="relative z-10 inline-flex h-2.5 w-2.5 rounded-full bg-status-down-fg dark:bg-status-down" />
        </span>
      ) : null}
      {latest?.ok ? t("statusUp") : latest ? t("statusDown") : "—"}
    </span>
  );
}
