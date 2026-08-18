"use client";

import { useTranslations } from "next-intl";
import { FormattedDateTime } from "@/components/formatted-date-time";
import { monitorStatusDownPillClass } from "@/lib/monitor-ui";

export type IncidentRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  message: string | null;
};

export function RecentIncidentsList({ incidents }: { incidents: IncidentRow[] }) {
  const t = useTranslations("monitorDetail");

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("colTime")}
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
              {t("colStatus")}
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
              {t("colCode")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("colResponse")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("colMessage")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {incidents.map((r) => (
            <tr key={r.id} className="hover:bg-bg-page/60">
              <td className="px-4 py-3 text-sm text-text-muted">
                <FormattedDateTime value={r.createdAt} />
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                <span className={monitorStatusDownPillClass}>
                  {t("statusBadgeDown")}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-sm text-text-muted sm:table-cell">
                {r.statusCode ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-text-muted">
                {r.responseTimeMs != null ? `${r.responseTimeMs} ms` : "—"}
              </td>
              <td className="max-w-[14rem] truncate px-4 py-3 text-sm text-text-muted" title={r.message ?? undefined}>
                {r.message ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
