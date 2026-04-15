"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

type MonitorRow = {
  name: string;
  status: boolean;
  uptime: string;
  ms: string;
  bars: string;
};

type DetailRow = {
  time: string;
  code: string;
  ms: string;
  ok: boolean;
};

type ActivityRow = {
  name: string;
  down: boolean;
  when: string;
};

type LandingHeroCarouselProps = {
  monitors: MonitorRow[];
  detailRows: DetailRow[];
  activityRows: ActivityRow[];
  upCount: number;
  labels: {
    panelTitle: string;
    panelStatus: string;
    panelFooter: string;
    dashboardTitle: string;
    dashboardBadge: string;
    dashboardStat: string;
    detailOverview: string;
    statusDown: string;
    configEvery: string;
    configTimeout: string;
    configSslOn: string;
    checkLogTitle: string;
    colTime: string;
    colCode: string;
    colResponse: string;
    activityTitle: string;
    activityCount: string;
    activityEventCount: string;
    wentDown: string;
    recovered: string;
    carouselLabel: string;
    previousLabel: string;
    nextLabel: string;
    pauseLabel: string;
    playLabel: string;
    indicatorLabel: string;
    slideLabel: string;
  };
};

export function LandingHeroCarousel({
  monitors,
  detailRows,
  activityRows,
  upCount,
  labels,
}: LandingHeroCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const slideCount = 3;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isPaused || userInteracted || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideCount);
    }, 4500);
    return () => window.clearInterval(id);
  }, [isPaused, userInteracted, prefersReducedMotion, slideCount]);

  function goToSlide(index: number, fromUser = false) {
    setActiveSlide(index);
    if (fromUser) setUserInteracted(true);
  }

  function previousSlide() {
    setUserInteracted(true);
    setActiveSlide((prev) => (prev - 1 + slideCount) % slideCount);
  }

  function nextSlide() {
    setUserInteracted(true);
    setActiveSlide((prev) => (prev + 1) % slideCount);
  }

  return (
    <div
      className="w-full max-w-[38rem] md:max-w-none justify-self-center md:justify-self-end"
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.carouselLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          previousSlide();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nextSlide();
        }
      }}
      tabIndex={0}
    >
      <div className="relative min-h-[358px] sm:min-h-[382px] overflow-hidden rounded-xl border border-border bg-bg-card" style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}>
        {[0, 1, 2].map((slideIdx) => (
          <div
            key={slideIdx}
            className={`transition-opacity duration-500 ${activeSlide === slideIdx ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"}`}
            aria-hidden={activeSlide !== slideIdx}
            role="group"
            aria-label={labels.slideLabel.replace("{current}", String(slideIdx + 1)).replace("{total}", String(slideCount))}
          >
            {slideIdx === 0 && (
              <div>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em]">
                    {labels.panelTitle}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500 animate-[operational-badge-dot_2.6s_ease-in-out_infinite] inline-block" />
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {labels.panelStatus.replace("{up}", String(upCount)).replace("{total}", String(monitors.length))}
                    </span>
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {monitors.map((m) => (
                    <div key={m.name} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="relative flex-shrink-0 size-2">
                        <span className={`size-2 rounded-full absolute inset-0 ${m.status ? "bg-green-500" : "bg-red-500"}`} />
                        {m.status && (
                          <span className="absolute inset-0 rounded-full bg-green-500 animate-[monitor-status-ring_1.85s_cubic-bezier(0,0,0.2,1)_infinite]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[13px] font-medium text-text-primary truncate">{m.name}</span>
                          <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0">{m.ms}</span>
                        </div>
                        <div className="flex items-end gap-px h-2.5">
                          {m.bars.split("").map((b, i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-[1px] ${b === "1" ? "bg-green-500/60" : "bg-red-500/60"}`}
                              style={{ height: b === "1" ? "100%" : "55%" }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className={`text-[12px] font-semibold tabular-nums flex-shrink-0 ${m.status ? "text-text-muted" : "text-red-500"}`}>
                        {m.uptime}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-border bg-bg-elevated/60">
                  <span className="text-[11px] text-text-muted">{labels.panelFooter}</span>
                </div>
              </div>
            )}

            {slideIdx === 1 && (
              <div>
                <div className="px-4 py-2.5 border-b border-border/80 bg-muted/30 dark:bg-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{labels.detailOverview}</span>
                </div>
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-display text-[13px] font-semibold text-text-primary">auth.service</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      {labels.statusDown}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted">https://auth.example.com/health</p>
                </div>
                <div className="px-4 pt-2 pb-2 border-b border-border">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">GET</span>
                    <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{labels.configEvery}</span>
                    <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{labels.configTimeout}</span>
                    <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{labels.configSslOn}</span>
                  </div>
                </div>
                <div className="px-4 py-2 border-b border-border bg-gradient-to-b from-muted/35 to-transparent dark:from-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{labels.checkLogTitle}</span>
                </div>
                <div className="px-4 py-2 border-b border-border grid grid-cols-[1fr_auto_auto] gap-3">
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{labels.colTime}</span>
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{labels.colCode}</span>
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold text-right">{labels.colResponse}</span>
                </div>
                <div className="divide-y divide-border">
                  {detailRows.map((row) => (
                    <div key={row.time} className="px-4 py-2 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                      <span className="text-[11px] text-text-primary tabular-nums">{row.time}</span>
                      <span className={`text-[11px] tabular-nums font-medium ${row.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {row.code}
                      </span>
                      <span className="text-[10px] text-text-muted tabular-nums text-right">{row.ms}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slideIdx === 2 && (
              <div>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em] block">
                      {labels.activityTitle}
                    </span>
                    <span className="text-[10px] text-text-muted">{labels.activityEventCount}</span>
                  </div>
                  <span className="text-[11px] text-text-muted tabular-nums">{labels.activityCount}</span>
                </div>
                <div className="divide-y divide-border">
                  {activityRows.map((row) => (
                    <div key={`${row.name}-${row.when}`} className="px-4 py-3 flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                          row.down
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}
                        aria-hidden
                      >
                        {row.down ? "↓" : "✓"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                            row.down
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}>
                            {row.down ? labels.wentDown : labels.recovered}
                          </span>
                          <span className="text-[11px] font-medium text-text-primary truncate">{row.name}</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-text-muted truncate">{row.name}.example.com</p>
                        <p className="mt-1 text-[10px] text-text-muted tabular-nums">{row.when}</p>
                      </div>
                      <span className="text-text-muted text-xs leading-none">×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={previousSlide}
            className="pointer-events-auto inline-flex size-7 items-center justify-center rounded-full border border-border bg-bg-card/95 text-text-muted hover:text-text-primary"
            aria-label={labels.previousLabel}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="pointer-events-auto inline-flex size-7 items-center justify-center rounded-full border border-border bg-bg-card/95 text-text-muted hover:text-text-primary"
            aria-label={labels.nextLabel}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsPaused((prev) => !prev);
            setUserInteracted(true);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-muted hover:text-text-primary"
          aria-label={isPaused ? labels.playLabel : labels.pauseLabel}
        >
          {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
        {Array.from({ length: slideCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToSlide(i, true)}
            className={`h-1.5 rounded-full transition-all ${activeSlide === i ? "w-5 bg-text-primary/55" : "w-2.5 bg-text-muted/30 hover:bg-text-muted/50"}`}
            aria-label={labels.indicatorLabel.replace("{index}", String(i + 1))}
          />
        ))}
      </div>
    </div>
  );
}
