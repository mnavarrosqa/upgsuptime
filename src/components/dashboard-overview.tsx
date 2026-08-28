"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, CircleCheck, CircleX, TriangleAlert, ShieldAlert, Timer, Clock, CircleDashed } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardAddMonitor } from "@/components/dashboard-add-monitor";
import { ActivityVolumeClient, FleetMixClient } from "@/components/dashboard-charts-client";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { MonitorFavicon } from "@/components/monitor-favicon";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/activity-item";
import type { ActivityDayPoint, FleetSlice, RankingPoint } from "@/components/dashboard-charts";

export type OverviewAttentionKind = "down" | "degraded" | "overdue" | "pending";

export type OverviewAttentionRow = {
  id: string;
  name: string;
  url: string;
  type: string;
  kind: OverviewAttentionKind;
  acked: boolean;
  since: string | null;
  detail: string | null;
  consecutiveFailures: number | null;
  latestMs: number | null;
  baselineMs: number | null;
};

export type OverviewNamedStat = {
  id: string;
  name: string;
  value: string;
  href: string;
  url: string;
  type: string;
};

export type DashboardOverviewProps = {
  hasMonitors: boolean;
  downCount: number;
  pausedCount: number;
  maintenanceCount: number;
  totalCount: number;
  fleetUptimePct: number | null;
  hasUptimeData: boolean;
  allPaused: boolean;
  checkLocation: string | null;
  username: string | null;
  attention: OverviewAttentionRow[];
  activity: ActivityItem[];
  fleet: FleetSlice[];
  activityByDay: ActivityDayPoint[];
  worstUptime: RankingPoint[];
  slowest: RankingPoint[];
  ssl: OverviewNamedStat[];
  onboarding?: {
    onboardingCompleted?: boolean | null;
    onboardingStep?: string | null;
  };
  userId: string;
};

function faviconSrc(url: string, type?: string | null): string {
  if (type === "dns" || type === "tcp") return "";
  try {
    return `/api/favicon?domain=${new URL(url).hostname}`;
  } catch {
    return "";
  }
}

function SiteLabel({
  name,
  url,
  type,
  className,
}: {
  name: string;
  url: string;
  type?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <MonitorFavicon src={faviconSrc(url, type)} size="sm" />
      <span className="min-w-0 truncate font-medium text-text-primary group-hover:text-accent">
        {name}
      </span>
    </span>
  );
}

const SLOWEST_MIN_MS = 300;

function MetaDot() {
  return (
    <span className="text-border-muted select-none" aria-hidden>
      ·
    </span>
  );
}

function StatusLiveDot({ tone }: { tone: "up" | "down" | "paused" | "warn" }) {
  return (
    <span className="relative mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center sm:mt-2" aria-hidden>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "up" && "bg-status-up animate-operational-badge-dot",
          tone === "down" && "bg-status-down",
          tone === "warn" && "bg-status-warn",
          tone === "paused" && "bg-text-muted/70"
        )}
      />
    </span>
  );
}

function AttentionAckButton({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const t = useTranslations("overview");
  const tAck = useTranslations("monitorDetail");
  const tErrors = useTranslations("errors");
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/monitors/${encodeURIComponent(monitorId)}/ack-downtime`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ acknowledged: true }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            toast.error(typeof data.error === "string" ? data.error : tErrors("fallback"));
            return;
          }
          toast.success(tAck("downtimeAckToast"));
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="text-xs font-medium text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline disabled:opacity-50"
    >
      {t("ack")}
    </button>
  );
}

function SectionHeading({
  children,
  href,
  hrefLabel,
  icon: Icon,
}: {
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        {children}
      </h2>
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
            className="group flex items-center justify-between gap-3 py-2.5 text-sm"
          >
            <SiteLabel name={row.name} url={row.url} type={row.type} />
            <span className="shrink-0 tabular-nums text-text-muted">{row.value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RankList({
  items,
  empty,
  format,
  fillFor,
  scale,
}: {
  items: RankingPoint[];
  empty: string;
  format: (n: number) => string;
  fillFor: (n: number) => string;
  scale: "pct" | "relative";
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{empty}</p>;
  }
  const max = Math.max(...items.map((row) => row.n), 1);
  return (
    <ul className="space-y-3">
      {items.map((row) => {
        const widthPct = scale === "pct" ? Math.min(100, row.n) : (row.n / max) * 100;
        return (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <SiteLabel
                  name={row.name}
                  url={row.url}
                  type={row.type}
                  className="transition-colors group-hover:text-accent"
                />
                <span className="shrink-0 tabular-nums text-text-muted">{format(row.n)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-border/70">
                <div
                  className="h-full rounded-sm motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: fillFor(row.n),
                  }}
                />
              </div>
            </Link>
          </li>
        );
      })}
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
  pausedCount,
  maintenanceCount,
  totalCount,
  fleetUptimePct,
  hasUptimeData,
  allPaused,
  checkLocation,
  username,
  attention,
  activity,
  fleet,
  activityByDay,
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
  const overdueCount = attention.filter((row) => row.kind === "overdue").length;
  const statusTone =
    downCount > 0 ? "down" : overdueCount > 0 ? "warn" : allPaused ? "paused" : "up";
  const statusLabel =
    downCount > 0
      ? tDash("downCount", { count: downCount })
      : overdueCount > 0
        ? t("overdueCount", { count: overdueCount })
        : allPaused
          ? tDash("allPaused")
          : tDash("allOperational");
  const showUptime = worstUptime.length > 0 || !hasUptimeData;
  const showSlowest =
    slowest.length > 0 && Math.max(...slowest.map((row) => row.n)) >= SLOWEST_MIN_MS;
  const showSsl = ssl.length > 0;
  const rankCount = Number(showUptime) + Number(showSlowest) + Number(showSsl);

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
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
              <div className="min-w-0 flex-1">
                <h1
                  className={cn(
                    "flex items-start gap-2.5 font-display text-[clamp(1.65rem,3.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight",
                    downCount > 0
                      ? "text-status-down"
                      : overdueCount > 0
                        ? "text-status-warn"
                        : "text-text-primary"
                  )}
                  aria-live="polite"
                >
                  <StatusLiveDot tone={statusTone} />
                  <span>{statusLabel}</span>
                </h1>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                  <span className="tabular-nums">{tDash("monitorCount", { count: totalCount })}</span>
                  {fleetUptimePct != null ? (
                    <>
                      <MetaDot />
                      <span className="tabular-nums">{t("fleetUptime90d", { pct: fleetUptimePct })}</span>
                    </>
                  ) : null}
                  {maintenanceCount > 0 ? (
                    <>
                      <MetaDot />
                      <span className="tabular-nums">{t("maintenanceCount", { count: maintenanceCount })}</span>
                    </>
                  ) : null}
                  {pausedCount > 0 && !allPaused ? (
                    <>
                      <MetaDot />
                      <span className="tabular-nums">{tDash("pausedCountMeta", { count: pausedCount })}</span>
                    </>
                  ) : null}
                  <MetaDot />
                  <span className="truncate">{tDash("checksFrom", { location: locationLabel })}</span>
                  {username ? (
                    <>
                      <MetaDot />
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
              <FleetMixClient fleet={fleet} totalCount={totalCount} />
            </div>

            {attention.length > 0 && (
              <section className="mt-10">
                <SectionHeading icon={TriangleAlert}>{t("attention")}</SectionHeading>
                <ul className="divide-y divide-border/70 text-sm">
                  {attention.map((row) => {
                    const tone =
                      row.kind === "degraded" || row.kind === "overdue" || row.kind === "pending"
                        ? "warn"
                        : row.acked
                          ? "muted"
                          : "down";
                    const Icon =
                      row.kind === "degraded"
                        ? Timer
                        : row.kind === "overdue"
                          ? Clock
                          : row.kind === "pending"
                            ? CircleDashed
                            : row.acked
                              ? CircleCheck
                              : CircleX;
                    const label =
                      row.kind === "degraded"
                        ? t("degraded")
                        : row.kind === "overdue"
                          ? t("overdue")
                          : row.kind === "pending"
                            ? t("pending")
                            : row.acked
                              ? t("acked")
                              : t("down");
                    const detail =
                      row.kind === "pending"
                        ? t("pendingDetail")
                        : row.kind === "degraded" && row.latestMs != null && row.baselineMs != null
                          ? t("degradedDetail", { recent: row.latestMs, baseline: row.baselineMs })
                          : row.kind === "down" && row.consecutiveFailures != null && row.consecutiveFailures > 1
                            ? [row.detail, t("failedChecks", { n: row.consecutiveFailures })]
                                .filter(Boolean)
                                .join(" · ")
                            : row.detail;
                    return (
                      <li key={row.id} className="flex items-start gap-3 py-2.5">
                        <Link
                          href={`/monitors/${row.id}`}
                          className="group min-w-0 flex-1"
                        >
                          <SiteLabel name={row.name} url={row.url} type={row.type} />
                          {detail ? (
                            <p className="mt-0.5 truncate pl-6 text-xs text-text-muted" title={detail}>
                              {detail}
                            </p>
                          ) : null}
                        </Link>
                        <div className="mt-0.5 flex shrink-0 items-center gap-2">
                          {row.kind === "down" && !row.acked ? (
                            <AttentionAckButton monitorId={row.id} />
                          ) : null}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium",
                              tone === "warn" && "text-status-warn",
                              tone === "muted" && "text-text-muted",
                              tone === "down" && "text-status-down"
                            )}
                          >
                            <Icon className="size-3.5 shrink-0" aria-hidden />
                            {label}
                            {row.since ? (
                              <span className="tabular-nums text-text-muted">
                                · {formatRelativeTime(row.since)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="mt-10">
              <SectionHeading href="/activity" hrefLabel={t("viewAll")}>
                {t("recentActivity")}
              </SectionHeading>
              <p className="mb-3 text-[11px] text-text-muted">{t("chartVolumeSub")}</p>
              <ActivityVolumeClient activityByDay={activityByDay} />
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">{t("activityEmpty")}</p>
              ) : (
                <ul className="mt-4 divide-y divide-border/70">
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
                          className="group flex items-center justify-between gap-3 py-2.5 text-sm"
                        >
                          <SiteLabel name={item.name} url={item.url} />
                          <span className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                            <span>{label}</span>
                            <time dateTime={item.at} className="tabular-nums">
                              {formatRelativeTime(item.at)}
                            </time>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {rankCount > 0 ? (
              <div className={cn("mt-10 grid gap-10", rankCount > 1 && "lg:grid-cols-2")}>
                {showUptime ? (
                  <section>
                    <SectionHeading href="/monitors" hrefLabel={tNav("monitors")}>
                      {t("worstUptime")}
                    </SectionHeading>
                    <RankList
                      items={worstUptime}
                      empty={t("noUptimeData")}
                      format={(n) => `${n}%`}
                      scale="pct"
                      fillFor={(n) =>
                        n < 99 ? "var(--color-status-down)" : "var(--color-status-warn)"
                      }
                    />
                  </section>
                ) : null}
                {showSlowest ? (
                  <section>
                    <SectionHeading href="/monitors" hrefLabel={tNav("monitors")}>
                      {t("slowest")}
                    </SectionHeading>
                    <RankList
                      items={slowest}
                      empty={t("noLatencyData")}
                      format={(n) => `${n} ms`}
                      scale="relative"
                      fillFor={(n) =>
                        n >= 1000 ? "var(--color-status-warn)" : "var(--color-accent)"
                      }
                    />
                  </section>
                ) : null}
                {showSsl ? (
                  <section>
                    <SectionHeading href="/monitors" hrefLabel={tNav("monitors")} icon={ShieldAlert}>
                      {t("ssl")}
                    </SectionHeading>
                    <StatList items={ssl} empty={t("sslClear")} />
                  </section>
                ) : null}
              </div>
            ) : null}
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
