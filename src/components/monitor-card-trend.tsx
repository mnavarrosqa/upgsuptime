"use client";

export type TrendPoint = { ok: boolean };

const TREND_BARS = 24;

export function MonitorCardTrend({ results }: { results: TrendPoint[] }) {
  if (results.length === 0) return null;

  const bars = [...results].reverse().slice(0, TREND_BARS);
  return (
    <div className="flex h-5 gap-px" aria-label="Uptime trend">
      {bars.map((r, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            minWidth: "2px",
            backgroundColor: r.ok ? "#10b981" : "#ef4444",
          }}
          title={r.ok ? "Up" : "Down"}
        />
      ))}
    </div>
  );
}
