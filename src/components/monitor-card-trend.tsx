"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  chronologicalTrend,
  sparklineChartValues,
  sparklineIndexFromViewX,
  type TrendPoint,
} from "@/lib/monitor-card-stats";
import { cn } from "@/lib/utils";

export type { TrendPoint };

export type SparklineTone = "up" | "down" | "muted";

const VW = 160;
const VH = 64;
const PAD_X = 0;
const PAD_RIGHT = 0;
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

function formatCheckWhen(
  date: string | Date | null | undefined,
  tTime: (key: string, values?: Record<string, number>) => string,
): string | null {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return tTime("justNow");
  if (diffMin < 60) return tTime("minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return tTime("hoursAgo", { count: diffHr });
  return tTime("daysAgo", { count: Math.floor(diffHr / 24) });
}

export function MonitorCardTrend({
  results,
  tone,
}: {
  results: TrendPoint[];
  tone: SparklineTone;
}) {
  const t = useTranslations("monitorsPage");
  const tTime = useTranslations("time");
  const rawId = useId();
  const gid = `mcg-${rawId.replace(/:/g, "")}`;
  const clipId = `${gid}-clip`;
  const liveId = `${gid}-live`;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geom = useMemo(() => {
    const chrono = chronologicalTrend(results);
    if (chrono.length === 0) return null;
    const values = sparklineChartValues(chrono);
    const spanX = VW - PAD_X - PAD_RIGHT;
    const spanY = VH - PAD_Y * 2;
    const yBottom = PAD_Y + spanY;
    const pts = values.map((v, i) => ({
      x: PAD_X + (values.length === 1 ? spanX : (i / (values.length - 1)) * spanX),
      y: PAD_Y + (1 - v) * spanY,
      check: chrono[i]!,
    }));
    const line = smoothLine(pts);
    const last = pts[pts.length - 1]!;
    const first = pts[0]!;
    const area = `${line} L ${last.x} ${yBottom} L ${first.x} ${yBottom} Z`;
    const cell = pts.length > 1 ? spanX / (pts.length - 1) : spanY / 3;
    const yTicks = Math.max(2, Math.round(spanY / cell));
    const gridY = Array.from({ length: yTicks + 1 }, (_, i) => PAD_Y + (i / yTicks) * spanY);
    const gridX = pts.map((p) => p.x);
    return { line, area, pts, gridX, gridY, yBottom };
  }, [results]);

  if (!geom) return null;

  const stroke =
    tone === "down"
      ? "var(--status-down)"
      : tone === "up"
        ? "var(--status-up)"
        : "var(--text-muted)";

  const activeIndex = hoverIndex ?? geom.pts.length - 1;
  const active = geom.pts[activeIndex]!;
  const activeCheck = active.check;
  const hovering = hoverIndex != null;
  const pointStroke =
    tone === "muted"
      ? stroke
      : activeCheck.ok
        ? "var(--status-up)"
        : "var(--status-down)";
  const when = formatCheckWhen(activeCheck.createdAt, tTime);
  const statusLabel = activeCheck.ok ? t("statusUp") : t("statusDown");
  const latency =
    activeCheck.responseTimeMs != null ? t("trendCheckMs", { ms: activeCheck.responseTimeMs }) : null;
  const liveText = [statusLabel, latency, when].filter(Boolean).join(" · ");

  function setFromClientX(target: HTMLElement, clientX: number) {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const viewX = ((clientX - rect.left) / rect.width) * VW;
    setHoverIndex(sparklineIndexFromViewX(viewX, geom!.pts.length, PAD_X, PAD_RIGHT, VW));
  }

  const tooltipLeft = (active.x / VW) * 100;
  const tooltipShift = tooltipLeft < 22 ? "0%" : tooltipLeft > 78 ? "-100%" : "-50%";

  return (
    <div
      className="relative h-16 w-full overflow-visible cursor-crosshair motion-safe:motion-soft-pop"
      aria-label={t("uptimeTrend")}
      aria-describedby={liveId}
      onPointerMove={(e) => setFromClientX(e.currentTarget, e.clientX)}
      onPointerLeave={() => setHoverIndex(null)}
    >
      <span id={liveId} className="sr-only" aria-live="polite">
        {liveText}
      </span>
      {hovering ? (
        <div
          className="pointer-events-none absolute top-0 z-10"
          style={{ left: `${tooltipLeft}%`, transform: `translateX(${tooltipShift})` }}
        >
          <div
            className={cn(
              "max-w-[11rem] rounded-md border border-border/80 bg-bg-card px-2 py-1 text-[11px] leading-snug shadow-md",
              activeCheck.ok ? "text-text-primary" : "text-status-down"
            )}
          >
            <p className="truncate font-medium">
              {statusLabel}
              {latency ? <span className="font-normal text-text-muted"> · {latency}</span> : null}
            </p>
            {when ? <p className="truncate text-text-muted">{when}</p> : null}
            {!activeCheck.ok && activeCheck.message ? (
              <p className="mt-0.5 truncate text-text-muted">{activeCheck.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}
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
          <clipPath id={clipId}>
            <rect x={PAD_X} y={PAD_Y} width={VW - PAD_X - PAD_RIGHT} height={VH - PAD_Y * 2} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width={VW} height={VH} fill="transparent" />
        {geom.gridY.map((y, i) => (
          <line
            key={`hy-${i}`}
            x1={PAD_X}
            y1={y}
            x2={VW - PAD_RIGHT}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeOpacity="0.85"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {geom.gridX.map((x, i) => (
          <line
            key={`vx-${i}`}
            x1={x}
            y1={PAD_Y}
            x2={x}
            y2={geom.yBottom}
            stroke="var(--border)"
            strokeWidth="1"
            strokeOpacity="0.85"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <g clipPath={`url(#${clipId})`}>
          <path d={geom.area} fill={`url(#${gid})`} />
        </g>
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
          x1={active.x}
          y1={PAD_Y}
          x2={active.x}
          y2={geom.yBottom}
          stroke={pointStroke}
          strokeWidth="1"
          strokeDasharray="2.5 3"
          strokeOpacity={hovering ? 0.7 : 0.45}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${(active.x / VW) * 100}%`,
          top: `${(active.y / VH) * 100}%`,
        }}
        aria-hidden
      >
        <span
          className={cn(
            "relative flex items-center justify-center overflow-visible",
            hovering ? "size-2.5" : "size-2"
          )}
        >
          {!hovering && tone === "up" ? (
            <span className="absolute inset-0 rounded-full bg-status-up/40 motion-safe:animate-monitor-status-ring" />
          ) : null}
          <span
            className="relative z-[1] size-full rounded-full border-2 border-bg-card"
            style={{ backgroundColor: pointStroke }}
          />
        </span>
      </span>
    </div>
  );
}
