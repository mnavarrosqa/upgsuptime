"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/lib/api-errors";

export type StatusPageMonitorRow = {
  id: string;
  name: string;
  url: string;
  showOnStatusPage: boolean;
};

export function StatusPageMonitorsVisibility({
  monitors,
}: {
  monitors: StatusPageMonitorRow[];
}) {
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");
  const apiErrorMessage = useApiErrorMessage();
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  async function setVisibility(monitorId: string, showOnStatusPage: boolean) {
    setSaving(monitorId);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(monitorId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnStatusPage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(apiErrorMessage(data));
        return;
      }
      router.refresh();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setSaving(null);
    }
  }

  if (monitors.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        {tAccount("statusPageMonitorsEmpty")}{" "}
        <Link
          href="/monitors"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {tAccount("statusPageMonitorsGoToMonitors")}
        </Link>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {monitors.map((m) => {
        const on = m.showOnStatusPage !== false;
        const busy = saving === m.id;
        return (
          <li
            key={m.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text-primary">{m.name}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted" title={m.url}>
                {m.url}
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2.5 sm:py-0.5">
              <input
                type="checkbox"
                checked={on}
                disabled={busy}
                onChange={(e) => setVisibility(m.id, e.target.checked)}
                className="ui-checkbox"
                aria-label={tAccount("statusPageMonitorShowAria", { name: m.name })}
              />
              <span className="text-sm text-text-primary">
                {tAccount("statusPageMonitorShowLabel")}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
