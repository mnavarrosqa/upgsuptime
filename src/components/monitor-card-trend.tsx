"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  chronologicalTrend,
  normalizeSparklineValues,
  sparklineHealthValues,
  type TrendPoint,
} from "@/lib/monitor-card-stats";

export type { TrendPoint };

export type SparklineTone = "up" | "down" | "muted";

const VW = 160;
const VH = 64;
const PAD_X = 6;
const PAD_RIGHT = 12;
const PAD_Y = 8;

function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function MonitorCardTrend({
  results,
  tone,
}: {
  results: TrendPoint[];
  tone: SparklineTone;
}) {
  const t = useTranslations("monitorsPage");
  const rawId = useId();
  const gid = `mcg-${rawId.replace(/:/g, "")}`;

  const geom = useMemo(() => {
    const chrono = chronologicalTrend(results);
    if (chrono.length === 0) return null;
    const values = normalizeSparklineValues(sparklineHealthValues(chrono));
    const spanX = VW - PAD_X - PAD_RIGHT;
    const spanY = VH - PAD_Y * 2;
    const pts = values.map((v, i) => ({
      x: PAD_X + (values.length === 1 ? spanX : (i / (values.length - 1)) * spanX),
      y: PAD_Y + (1 - v) * spanY,
    }));
    const line = smoothLine(pts);
    const last = pts[pts.length - 1]!;
    const first = pts[0]!;
    const area = `${line} L ${last.x} ${VH} L ${first.x} ${VH} Z`;
    return { line, area, last };
  }, [results]);

  if (!geom) return null;

  const stroke =
    tone === "down"
      ? "var(--status-down)"
      : tone === "up"
        ? "var(--status-up)"
        : "var(--text-muted)";

  return (
    <div className="h-16 w-full min-w-28 motion-safe:motion-soft-pop" aria-label={t("uptimeTrend")}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geom.area} fill={`url(#${gid})`} />
        <path
          d={geom.line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={geom.last.x}
          y1={PAD_Y - 2}
          x2={geom.last.x}
          y2={VH - 4}
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray="2.5 3"
          strokeOpacity="0.45"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={geom.last.x}
          cy={geom.last.y}
          r="3.25"
          fill={stroke}
          stroke="var(--bg-card)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
