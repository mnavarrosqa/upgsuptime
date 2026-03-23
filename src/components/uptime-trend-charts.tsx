"use client";

import { useId } from "react";
import type { TooltipProps } from "recharts";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type ChartResultRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  responseTimeMs: number | null;
};

function formatAxisTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ResponseTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartResultRow;
  const ms = row.responseTimeMs;
  const timeLabel = typeof label === "string" ? formatAxisTime(label) : String(label);

  return (
    <div
      className="rounded-md border border-border bg-bg-card px-3 py-2 text-xs shadow-sm"
      style={{ color: "var(--color-text-primary)" }}
    >
      <p className="text-text-muted">{timeLabel}</p>
      <p className="mt-1 font-medium text-text-primary">
        {row.ok ? "Up" : "Down"}
      </p>
      <p className="mt-0.5 text-text-muted">
        Response:{" "}
        {ms != null ? (
          <span className="font-medium text-text-primary">{ms} ms</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </p>
    </div>
  );
}

export function UptimeTrendCharts({ results }: { results: ChartResultRow[] }) {
  const gradientId = useId().replace(/:/g, "");

  if (results.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
        No check data yet. Charts will appear after the cron job runs.
      </div>
    );
  }

  const chronological = [...results].reverse();
  const upCount = chronological.filter((r) => r.ok).length;
  const downCount = chronological.length - upCount;

  const chartData: ChartResultRow[] = chronological;

  return (
    <div className="mt-4 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Uptime
        </p>
        <div
          className="mt-2 flex h-8 w-full gap-px"
          aria-label={`${upCount} successful checks, ${downCount} failed checks, ${chronological.length} total, oldest left to newest right`}
        >
          {chronological.map((r) => (
            <span
              key={r.id}
              className={`min-w-[3px] flex-1 rounded-sm transition-opacity hover:opacity-70 ${
                r.ok
                  ? "bg-emerald-500 dark:bg-emerald-600"
                  : "bg-red-500 dark:bg-red-600"
              }`}
              title={`${formatAxisTime(r.createdAt)} · ${r.ok ? "Up" : "Down"}`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>Older</span>
          <span>Newer</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Response time
        </p>
        <div className="mt-2 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="createdAt"
                tickFormatter={formatAxisTime}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={(v) => `${v} ms`}
                domain={[0, "auto"]}
                width={48}
              />
              <Tooltip content={<ResponseTooltip />} />
              <Area
                type="monotone"
                dataKey="responseTimeMs"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-accent)" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
