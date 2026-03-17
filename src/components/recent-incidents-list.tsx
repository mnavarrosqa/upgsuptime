"use client";

import { FormattedDateTime } from "@/components/formatted-date-time";

export type IncidentRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  message: string | null;
};

export function RecentIncidentsList({ incidents }: { incidents: IncidentRow[] }) {
  if (incidents.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border-muted bg-bg-page p-6 text-center text-sm text-text-muted">
        No recent incidents.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Code
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Response
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Message
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {incidents.map((r) => (
            <tr key={r.id} className="hover:bg-bg-page">
              <td className="px-4 py-3 text-sm text-text-muted">
                <FormattedDateTime value={r.createdAt} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400">
                  Down
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-text-muted">
                {r.statusCode ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-text-muted">
                {r.responseTimeMs != null ? `${r.responseTimeMs} ms` : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-text-muted max-w-[14rem] truncate" title={r.message ?? undefined}>
                {r.message ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
