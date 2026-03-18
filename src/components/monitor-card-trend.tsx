"use client";

export type TrendPoint = { ok: boolean; responseTimeMs?: number | null };

const TREND_BARS = 24;

export function MonitorCardTrend({ results }: { results: TrendPoint[] }) {
  if (results.length === 0) return null;

  const bars = [...results].reverse().slice(0, TREND_BARS);
  const maxMs = Math.max(...bars.map((r) => r.responseTimeMs ?? 0), 1);

  return (
    <div className="flex h-6 items-end gap-px" aria-label="Uptime trend">
      {bars.map((r, i) => {
        const heightPct =
          r.responseTimeMs != null
            ? Math.max(20, Math.round((r.responseTimeMs / maxMs) * 100))
            : 100;
        const label =
          r.responseTimeMs != null
            ? `${r.ok ? "Up" : "Down"} · ${r.responseTimeMs}ms`
            : r.ok
              ? "Up"
              : "Down";
        return (
          <span
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${heightPct}%`,
              minWidth: "2px",
              backgroundColor: r.ok ? "#10b981" : "#ef4444",
            }}
            title={label}
          />
        );
      })}
    </div>
  );
}
