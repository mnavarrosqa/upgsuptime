"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormattedDateTime } from "@/components/formatted-date-time";
import { Button } from "@/components/ui/button";

type CheckResultRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  message: string | null;
};

const PAGE_SIZE = 10;

export function CheckResultsTable({
  results,
  hideMessage = false,
}: {
  results: CheckResultRow[];
  hideMessage?: boolean;
}) {
  const t = useTranslations("monitorDetail");
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const pageResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-md border border-border bg-bg-page">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                {t("colTime")}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                {t("colStatus")}
              </th>
              <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                {t("colCode")}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                {t("colResponse")}
              </th>
              {!hideMessage && (
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  {t("colMessage")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageResults.map((r) => (
              <tr key={r.id} className="hover:bg-bg-page">
                <td className="px-4 py-2.5 text-sm text-text-muted">
                  <FormattedDateTime value={r.createdAt} />
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.ok
                        ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    {r.ok ? t("statusBadgeUp") : t("statusBadgeDown")}
                  </span>
                </td>
                <td className="hidden px-4 py-2.5 text-sm text-text-muted sm:table-cell">
                  {r.statusCode ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-sm text-text-muted">
                  {r.responseTimeMs != null ? `${r.responseTimeMs}ms` : "—"}
                </td>
                {!hideMessage && (
                  <td className="hidden max-w-[14rem] truncate px-4 py-2.5 text-sm text-text-muted sm:table-cell" title={r.message ?? undefined}>
                    {r.message ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-text-muted">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, results.length)} of {results.length}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="min-h-11 rounded border-border px-4 py-2 text-sm hover:bg-bg-page"
            >
              {t("paginationPrev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="min-h-11 rounded border-border px-4 py-2 text-sm hover:bg-bg-page"
            >
              {t("paginationNext")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
