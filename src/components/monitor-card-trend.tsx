"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";

export type TrendPoint = { id?: string; ok: boolean; responseTimeMs?: number | null };

const TREND_BARS = 24;

export function MonitorCardTrend({ results }: { results: TrendPoint[] }) {
  const prevNewestIdRef = useRef<string | null>(null);
  const [pulseGen, setPulseGen] = useState(0);

  const bars = useMemo(() => {
    if (results.length === 0) return [];
    return [...results].reverse().slice(0, TREND_BARS);
  }, [results]);

  useEffect(() => {
    const newest = bars[bars.length - 1];
    const nid = newest?.id;
    if (!nid) return;
    const prev = prevNewestIdRef.current;
    prevNewestIdRef.current = nid;
    if (prev !== null && prev !== nid) {
      startTransition(() => setPulseGen((g) => g + 1));
    }
  }, [bars]);

  if (bars.length === 0) return null;

  const maxMs = Math.max(...bars.map((r) => r.responseTimeMs ?? 0), 1);
  const newestIndex = bars.length - 1;

  return (
    <div className="-mt-2 overflow-visible pt-2" aria-label="Uptime trend">
      <div className="flex h-6 items-end gap-px overflow-visible">
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
        const isNewest = i === newestIndex;
        const stableKey = r.id ?? `idx-${i}`;
        const useNewCheckFall = isNewest && pulseGen > 0;
        const remountKey = useNewCheckFall ? `${stableKey}-p-${pulseGen}` : stableKey;
        return (
          <span
            key={remountKey}
            className={`origin-bottom flex-1 rounded-[1px] ${
              useNewCheckFall ? "animate-monitor-trend-bar-new" : "animate-monitor-trend-bar"
            }`}
            style={{
              height: `${heightPct}%`,
              minWidth: "2px",
              backgroundColor: r.ok ? "#10b981" : "#ef4444",
              animationDelay: useNewCheckFall ? "0ms" : `${i * 10}ms`,
            }}
            title={label}
          />
        );
      })}
      </div>
    </div>
  );
}
