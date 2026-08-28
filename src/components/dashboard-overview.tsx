"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Provider as TooltipProvider,
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
  Portal as TooltipPortal,
  Content as TooltipContent,
} from "@radix-ui/react-tooltip";
import { CircleHelp, ExternalLink } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardAddMonitor } from "@/components/dashboard-add-monitor";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/activity-item";

export type OverviewAttentionRow = {
  id: string;
  name: string;
  acked: boolean;
  degraded: boolean;
};

export type OverviewNamedStat = {
  id: string;
  name: string;
  value: string;
  href: string;
};

export type DashboardOverviewProps = {
  hasMonitors: boolean;
  downCount: number;
  upCount: number;
  pausedCount: number;
  totalCount: number;
  allPaused: boolean;
  checkLocation: string | null;
  username: string | null;
  attention: OverviewAttentionRow[];
  activity: ActivityItem[];
  worstUptime: OverviewNamedStat[];
  slowest: OverviewNamedStat[];
  ssl: OverviewNamedStat[];
  onboarding?: {
    onboardingCompleted?: boolean | null;
    onboardingStep?: string | null;
  };
  userId: string;
};

function StatusLiveDot({ tone }: { tone: "up" | "down" | "paused" }) {
  return (
    <span className="relative mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center sm:mt-2" aria-hidden>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "up" && "bg-status-up animate-operational-badge-dot",
          tone === "down" && "bg-status-down",
          tone === "paused" && "bg-text-muted/70"
        )}
      />
    </span>
  );
}

function SectionHeading({
  children,
  href,
  hrefLabel,
}: {
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{children}</h2>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function StatList({ items, empty }: { items: OverviewNamedStat[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border/70">
      {items.map((row) => (
        <li key={row.id}>
          <Link
            href={row.href}
            className="flex items-baseline justify-between gap-3 py-2.5 text-sm transition-colors hover:text-accent"
          >
            <span className="min-w-0 truncate font-medium text-text-primary">{row.name}</span>
            <span className="shrink-0 tabular-nums text-text-muted">{row.value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "<1m";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export function DashboardOverview({
  hasMonitors,
  downCount,
  upCount,
  pausedCount,
  totalCount,
  allPaused,
  checkLocation,
  username,
  attention,
  activity,
  worstUptime,
  slowest,
  ssl,
  onboarding,
  userId,
}: DashboardOverviewProps) {
  const router = useRouter();
  const t = useTranslations("overview");
  const tDash = useTranslations("dashboard");
  const tActivity = useTranslations("activity");
  const tNav = useTranslations("nav");
  const [showOnboarding, setShowOnboarding] = useState(
    !onboarding?.onboardingCompleted && !hasMonitors
  );

  const locationLabel = checkLocation ?? tDash("statValueLocationUnknown");
  const statusTone = downCount > 0 ? "down" : allPaused ? "paused" : "up";
  const statusLabel =
    downCount > 0
      ? tDash("downCount", { count: downCount })
      : allPaused
        ? tDash("allPaused")
        : tDash("allOperational");

  return (
    <>
      <AutoRefresh />
      <div className="motion-safe:motion-enter">
        {!hasMonitors ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(1.65rem,3.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight text-text-primary">
                {t("emptyTitle")}
              </h1>
              <p className="mt-2.5 max-w-md text-sm text-text-muted">{t("emptyBody")}</p>
            </div>
            <div className="shrink-0 sm:pt-1">
              <DashboardAddMonitor />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h1
                  className={cn(
                    "flex items-start gap-2.5 font-display text-[clamp(1.65rem,3.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight",
                    downCount > 0 ? "text-status-down" : "text-text-primary"
                  )}
                  aria-live="polite"
                >
                  <StatusLiveDot tone={statusTone} />
                  <span>{statusLabel}</span>
                </h1>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                  <span className="tabular-nums">{tDash("monitorCount", { count: totalCount })}</span>
                  {pausedCount > 0 && !allPaused ? (
                    <>
                      <span className="text-border-muted select-none" aria-hidden>
                        ·
                      </span>
                      <span className="tabular-nums">{tDash("pausedCountMeta", { count: pausedCount })}</span>
                    </>
                  ) : null}
                  <span className="text-border-muted select-none" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="truncate">{tDash("checksFrom", { location: locationLabel })}</span>
                    <TooltipProvider delayDuration={140}>
                      <TooltipRoot>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-text-muted/90 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                            aria-label={tDash("statLocationTooltip")}
                          >
                            <CircleHelp className="size-3.5 shrink-0" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipPortal>
                          <TooltipContent
                            side="top"
                            sideOffset={6}
                            className="z-50 max-w-[20rem] rounded-md border border-border bg-bg-card px-2.5 py-2 text-[11px] font-medium text-text-primary shadow-md"
                          >
                            {tDash("statLocationTooltip")}
                          </TooltipContent>
                        </TooltipPortal>
                      </TooltipRoot>
                    </TooltipProvider>
                  </span>
                  {username ? (
                    <>
                      <span className="text-border-muted select-none" aria-hidden>
                        ·
                      </span>
                      <Link
                        href={`/status/${username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-text-primary underline-offset-4 transition-colors hover:text-text-muted hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {tDash("statusPageLink")}
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <Link
                href="/monitors"
                className="shrink-0 self-start rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary sm:mt-1"
              >
                {t("seeMonitors")}
              </Link>
            </div>

            <dl className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-text-muted">{t("kpiUp")}</dt>
                <dd className="font-semibold text-status-up">{upCount}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-text-muted">{t("kpiDown")}</dt>
                <dd className={cn("font-semibold", downCount > 0 ? "text-status-down" : "text-text-primary")}>
                  {downCount}
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-text-muted">{t("kpiPaused")}</dt>
                <dd className="font-semibold text-text-primary">{pausedCount}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-text-muted">{t("kpiTotal")}</dt>
                <dd className="font-semibold text-text-primary">{totalCount}</dd>
              </div>
            </dl>

            {attention.length > 0 && (
              <section className="mt-10">
                <SectionHeading>{t("attention")}</SectionHeading>
                <ul className="divide-y divide-border/70">
                  {attention.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/monitors/${row.id}`}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm transition-colors hover:text-accent"
                      >
                        <span className="min-w-0 truncate font-medium text-text-primary">{row.name}</span>
                        <span className="shrink-0 text-xs font-medium text-status-down">
                          {row.degraded
                            ? t("degraded")
                            : row.acked
                              ? t("acked")
                              : t("down")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <section>
                <SectionHeading href="/activity" hrefLabel={t("viewAll")}>
                  {t("recentActivity")}
                </SectionHeading>
                {activity.length === 0 ? (
                  <p className="text-sm text-text-muted">{t("activityEmpty")}</p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {activity.map((item) => {
                      const label =
                        item.kind === "degradation"
                          ? tActivity("degradationBadge")
                          : item.recovered
                            ? tActivity("recovered")
                            : tActivity("wentDown");
                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <Link
                            href={`/monitors/${item.monitorId}`}
                            className="flex items-baseline justify-between gap-3 py-2.5 text-sm transition-colors hover:text-accent"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-text-primary">{item.name}</span>
                              <span className="ml-2 text-xs text-text-muted">{label}</span>
                            </span>
                            <time
                              dateTime={item.at}
                              className="shrink-0 tabular-nums text-xs text-text-muted"
                            >
                              {formatRelativeTime(item.at)}
                            </time>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <SectionHeading href="/monitors" hrefLabel={tNav("monitors")}>
                  {t("worstUptime")}
                </SectionHeading>
                <StatList items={worstUptime} empty={t("noUptimeData")} />
              </section>

              <section>
                <SectionHeading href="/monitors" hrefLabel={tNav("monitors")}>
                  {t("slowest")}
                </SectionHeading>
                <StatList items={slowest} empty={t("noLatencyData")} />
              </section>

              <section>
                <SectionHeading href="/monitors" hrefLabel={tNav("monitors")}>
                  {t("ssl")}
                </SectionHeading>
                <StatList items={ssl} empty={t("sslClear")} />
              </section>
            </div>
          </>
        )}
      </div>

      <OnboardingOverlay
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        userId={userId}
        currentStep={onboarding?.onboardingStep as "welcome" | "add-monitor" | "alerts" | "status-page" | "complete" | null}
        username={username}
        onComplete={() => {
          setShowOnboarding(false);
          router.refresh();
        }}
      />
    </>
  );
}
