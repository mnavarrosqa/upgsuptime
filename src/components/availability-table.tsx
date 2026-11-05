import { useTranslations } from "next-intl";
import type { AvailabilityRow } from "@/lib/availability";
import { formatDurationMs } from "@/lib/format-duration";

const PERIOD_KEY = {
  today: "availPeriodToday",
  "7d": "availPeriod7d",
  "30d": "availPeriod30d",
  "365d": "availPeriod365d",
} as const satisfies Record<AvailabilityRow["period"], string>;

const dur = (ms: number) => (ms > 0 ? formatDurationMs(ms) : "—");

export function AvailabilityTable({ rows }: { rows: AvailabilityRow[] }) {
  const t = useTranslations("monitorDetail");
  const th = "px-4 py-3 text-right text-xs font-medium text-text-muted";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-3.5">
        <h2
          className="text-xs font-medium text-text-muted"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("availTitle")}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${th} !text-left`}>{t("availPeriod")}</th>
              <th scope="col" className={th}>{t("availAvailability")}</th>
              <th scope="col" className={th}>{t("availDowntime")}</th>
              <th scope="col" className={th}>{t("availIncidents")}</th>
              <th scope="col" className={`${th} hidden sm:table-cell`}>{t("availLongest")}</th>
              <th scope="col" className={`${th} hidden sm:table-cell`}>{t("availAvg")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.period}>
                <th scope="row" className="px-4 py-3 text-left font-medium text-text-primary">
                  {t(PERIOD_KEY[r.period])}
                </th>
                <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                  {r.availabilityPct == null ? "—" : `${r.availabilityPct.toFixed(4)}%`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-muted">{dur(r.downtimeMs)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-text-muted">{r.incidents}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-text-muted sm:table-cell">{dur(r.longestMs)}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-text-muted sm:table-cell">{dur(r.avgMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
