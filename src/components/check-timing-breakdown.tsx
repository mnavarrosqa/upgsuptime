import { useTranslations } from "next-intl";
import {
  TIMING_PHASES,
  breakdownTotal,
  type TimingBreakdown,
  type TimingPhase,
  type TimingSummary,
} from "@/lib/timing-breakdown";

const PHASE_COLOR: Record<TimingPhase, string> = {
  dns: "var(--timing-dns)",
  connect: "var(--timing-connect)",
  tls: "var(--timing-tls)",
  server: "var(--timing-server)",
  download: "var(--timing-download)",
};

const PHASE_LABEL_KEY = {
  dns: "timingPhaseDns",
  connect: "timingPhaseConnect",
  tls: "timingPhaseTls",
  server: "timingPhaseServer",
  download: "timingPhaseDownload",
} as const satisfies Record<TimingPhase, string>;

function formatMs(value: number | null): string {
  return value == null ? "—" : `${value} ms`;
}

function TimingBar({
  label,
  breakdown,
  scaleMs,
  phaseLabel,
}: {
  label: string;
  breakdown: TimingBreakdown;
  scaleMs: number;
  phaseLabel: (phase: TimingPhase) => string;
}) {
  const total = breakdownTotal(breakdown);
  const segments = TIMING_PHASES.filter((phase) => (breakdown[phase] ?? 0) > 0);
  const summary = segments.map((phase) => `${phaseLabel(phase)} ${formatMs(breakdown[phase])}`).join(", ");

  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div
        role="img"
        aria-label={`${label}: ${summary}`}
        className="flex h-3 overflow-hidden rounded-[4px]"
        style={{ width: `${scaleMs > 0 ? Math.max(2, (total / scaleMs) * 100) : 0}%`, gap: 2 }}
      >
        {segments.map((phase) => (
          <span
            key={phase}
            title={`${phaseLabel(phase)}: ${formatMs(breakdown[phase])}`}
            className="h-full min-w-[2px]"
            style={{ flexGrow: breakdown[phase] ?? 0, flexBasis: 0, backgroundColor: PHASE_COLOR[phase] }}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums text-text-primary">{formatMs(total)}</span>
    </div>
  );
}

export function CheckTimingBreakdown({ summary }: { summary: TimingSummary }) {
  const t = useTranslations("monitorDetail");
  const phaseLabel = (phase: TimingPhase) => t(PHASE_LABEL_KEY[phase]);
  const scaleMs = Math.max(breakdownTotal(summary.latest), breakdownTotal(summary.median));
  // Skip phases that never took time (e.g. download for HTTP checks, which do not read the body).
  const rows = TIMING_PHASES.filter(
    (phase) => (summary.latest[phase] ?? 0) > 0 || (summary.median[phase] ?? 0) > 0,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-3.5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest text-text-muted"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("timingTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-text-muted">{t("timingSubtitle")}</p>
      </div>
      <div className="space-y-5 p-5 md:p-6">
        <div className="space-y-2.5">
          <TimingBar label={t("timingLatest")} breakdown={summary.latest} scaleMs={scaleMs} phaseLabel={phaseLabel} />
          <TimingBar label={t("timingMedian")} breakdown={summary.median} scaleMs={scaleMs} phaseLabel={phaseLabel} />
        </div>

        <table className="w-full text-sm">
          <caption className="sr-only">{t("timingMedianOf", { n: summary.sampleCount })}</caption>
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-text-muted">
              <th scope="col" className="pb-2 font-medium">{t("timingPhase")}</th>
              <th scope="col" className="pb-2 text-right font-medium">{t("timingLatest")}</th>
              <th scope="col" className="pb-2 text-right font-medium">{t("timingMedian")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((phase) => (
              <tr key={phase}>
                <th scope="row" className="py-1.5 text-left font-normal text-text-primary">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: PHASE_COLOR[phase] }}
                    />
                    {phaseLabel(phase)}
                  </span>
                </th>
                <td className="py-1.5 text-right tabular-nums text-text-muted">{formatMs(summary.latest[phase])}</td>
                <td className="py-1.5 text-right tabular-nums text-text-muted">{formatMs(summary.median[phase])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs text-text-muted">
          {t("timingMedianOf", { n: summary.sampleCount })}. {t("timingNote")}
        </p>
      </div>
    </section>
  );
}
