"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export type ChartResultRow = {
  id: string;
  createdAt: string;
  ok: boolean;
  responseTimeMs: number | null;
};

function formatAxisTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UptimeTrendCharts({ results }: { results: ChartResultRow[] }) {
  if (results.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
        No check data yet. Charts will appear after the cron job runs.
      </div>
    );
  }

  const chronological = [...results].reverse();
  const chartData = chronological.map((r) => ({
    ...r,
    responseTimeMs: r.responseTimeMs ?? 0,
    statusValue: 1,
  }));

  return (
    <div className="mt-4 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</p>
        <div className="mt-2 h-[100px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <XAxis
                dataKey="createdAt"
                tickFormatter={formatAxisTime}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={[0, 1]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                }}
                labelFormatter={formatAxisTime}
                formatter={(_value: number, _name: string, props: { payload?: ChartResultRow }) => [
                  props.payload?.ok ? "Up" : "Down",
                  "Status",
                ]}
              />
              <Bar dataKey="statusValue" fill="transparent" isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={entry.ok ? "#10b981" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Response time</p>
        <div className="mt-2 h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="createdAt"
                tickFormatter={formatAxisTime}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={(v) => `${v} ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                }}
                labelFormatter={formatAxisTime}
                formatter={(value: number) => [`${value} ms`, "Response time"]}
              />
              <Line
                type="monotone"
                dataKey="responseTimeMs"
                stroke="var(--color-text-muted)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
