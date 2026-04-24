"use client";

import { useEffect, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle,
  Cog,
  Gauge,
  History,
  Globe,
  ServerOff,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatRelativeTime, formatDuration } from "@/lib/format-time";
import { cn } from "@/lib/utils";

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

type MonitorStat = {
  id: string;
  name: string;
  url: string;
  currentStatus: boolean | null;
  lastCheckAt: string | null;
  lastStatusChangedAt: string | null;
  uptimePct: number | null;
  checkCount90d: number;
  buckets: { ok: number; total: number }[];
  avgResponseTimeMs: number | null;
  lastErrorMessage: string | null;
  lastErrorCode: number | null;
  maintenanceActive?: boolean;
  maintenanceNote?: string | null;
};

export function StatusPageShell({
  username,
  pageTitle,
  pageTagline,
  showPoweredBy,
  isOwner,
  isLoggedIn,
  monitors,
  downCount,
  incidents,
  generatedAt,
}: {
  username: string;
  /** Main heading; usually custom title or username. */
  pageTitle: string;
  /** Optional subtitle under the title. */
  pageTagline: string | null;
  /** Whether to show product branding in the footer. */
  showPoweredBy: boolean;
  /** Logged-in user is the owner of this public page. */
  isOwner: boolean;
  /** Any authenticated session (hides guest marketing CTA). */
  isLoggedIn: boolean;
  monitors: MonitorStat[];
  downCount: number;
  incidents: MonitorStat[];
  generatedAt: string;
}) {
  const router = useRouter();
  const tPublic = useTranslations("publicStatus");

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);

  const allOperational = downCount === 0 && monitors.length > 0;
  const hasMonitors = monitors.length > 0;

  // Overall stats (client-side aggregation)
  const totalChecks = monitors.reduce((s, m) => s + m.checkCount90d, 0);
  const uptimePcts = monitors
    .filter((m) => m.uptimePct !== null)
    .map((m) => m.uptimePct!);
  const avgUptime =
    uptimePcts.length > 0
      ? (uptimePcts.reduce((a, b) => a + b, 0) / uptimePcts.length).toFixed(1)
      : null;
  const responseTimes = monitors
    .filter((m) => m.avgResponseTimeMs !== null)
    .map((m) => m.avgResponseTimeMs!);
  const avgResponse =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="safe-top border-b border-border bg-bg-card/90 backdrop-blur-[8px]">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {tPublic("eyebrow")}
              </p>
              <h1
                className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.65rem]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {pageTitle}
              </h1>
              {pageTitle.trim() !== username.trim() && (
                <p className="mt-1 text-xs text-text-muted">
                  <span className="text-text-muted/80">/status/</span>
                  {username}
                </p>
              )}
              <p className="mt-1 text-sm text-text-muted">
                {pageTagline
                  ? pageTagline
                  : hasMonitors
                    ? tPublic("servicesOnPage", { count: monitors.length })
                    : tPublic("noServicesPublished")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
              <p className="text-xs tabular-nums text-text-muted">
                {tPublic("updated")}{" "}
                <time dateTime={generatedAt}>{formatRelativeTime(generatedAt)}</time>
              </p>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {isOwner && (
        <div className="border-b border-border bg-bg-card/70">
          <div className="mx-auto max-w-4xl px-4 py-2.5 sm:px-6">
            <Link
              href="/account#status"
              className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-text-primary transition-colors [transition-timing-function:var(--motion-ease-out-quart)] hover:text-primary"
              aria-label={tPublic("customizeAria")}
            >
              <Cog className="h-4 w-4 shrink-0" aria-hidden />
              <span>{tPublic("customizeLink")}</span>
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        {hasMonitors ? (
          <div
            className={cn(
              "motion-enter overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm dark:shadow-none",
              allOperational
                ? "border-l-[3px] border-l-primary"
                : "border-l-[3px] border-l-destructive"
            )}
          >
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:p-6">
              <div className="flex min-w-0 gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    allOperational
                      ? "bg-primary/12 text-primary"
                      : "bg-destructive/10 text-destructive"
                  )}
                  aria-hidden
                >
                  {allOperational ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {allOperational
                      ? tPublic("allOperational")
                      : tPublic("servicesUnavailable", { count: downCount })}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {allOperational
                      ? tPublic("allOperationalBody")
                      : tPublic("servicesUnavailableBody")}
                  </p>
                </div>
              </div>
              {(avgUptime !== null || avgResponse !== null || totalChecks > 0) && (
                <dl className="flex w-full shrink-0 flex-wrap gap-3 sm:w-auto sm:justify-end sm:gap-4">
                  {avgUptime !== null && (
                    <div className="min-w-[5.75rem] flex-1 rounded-lg bg-bg-page px-3 py-2.5 ring-1 ring-border/80 sm:flex-initial">
                      <dt className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
                        <Activity className="h-3 w-3 shrink-0" aria-hidden />
                        {tPublic("uptime")}
                      </dt>
                      <dd
                        className={cn(
                          "mt-1 text-lg font-semibold tabular-nums tracking-tight",
                          parseFloat(avgUptime) >= 99.5
                            ? "text-primary"
                            : parseFloat(avgUptime) >= 95
                              ? "text-chart-hist-warn"
                              : "text-destructive"
                        )}
                      >
                        {avgUptime}%
                      </dd>
                      <dd className="text-[0.65rem] text-text-muted">{tPublic("ninetyDayAverage")}</dd>
                    </div>
                  )}
                  {avgResponse !== null && (
                    <div className="min-w-[5.75rem] flex-1 rounded-lg bg-bg-page px-3 py-2.5 ring-1 ring-border/80 sm:flex-initial">
                      <dt className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
                        <Gauge className="h-3 w-3 shrink-0" aria-hidden />
                        {tPublic("response")}
                      </dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-text-primary">
                        {avgResponse}
                        <span className="text-sm font-medium text-text-muted">ms</span>
                      </dd>
                      <dd className="text-[0.65rem] text-text-muted">{tPublic("average")}</dd>
                    </div>
                  )}
                  {totalChecks > 0 && (
                    <div className="min-w-[5.75rem] flex-1 rounded-lg bg-bg-page px-3 py-2.5 ring-1 ring-border/80 sm:flex-initial">
                      <dt className="flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
                        <History className="h-3 w-3 shrink-0" aria-hidden />
                        {tPublic("checks")}
                      </dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-text-primary">
                        {totalChecks > 999
                          ? `${(totalChecks / 1000).toFixed(1)}k`
                          : totalChecks.toLocaleString()}
                      </dd>
                      <dd className="text-[0.65rem] text-text-muted">{tPublic("ninetyDays")}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        ) : (
          <div className="motion-enter flex flex-col items-center rounded-2xl border border-dashed border-border-muted bg-bg-card/50 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-text-muted">
              <ServerOff className="h-7 w-7" aria-hidden />
            </div>
            <p
              className="mt-4 text-base font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tPublic("emptyTitle")}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
              {tPublic("emptyBody")}
            </p>
          </div>
        )}

        {hasMonitors && (
          <section className="mt-10" aria-labelledby="status-services-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2
                  id="status-services-heading"
                  className="text-sm font-semibold tracking-tight text-text-primary"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {tPublic("servicesHeading")}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  {tPublic("servicesRefreshHint")}
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-4">
              {monitors.map((m, idx) => {
                const favicon = getFaviconUrl(m.url);
                const inMaintenance = m.maintenanceActive === true;
                const isUp = m.currentStatus === true;
                const isDown = m.currentStatus === false && !inMaintenance;
                const uptimeColor =
                  m.uptimePct === null
                    ? "text-text-muted"
                    : m.uptimePct >= 99.5
                      ? "text-primary"
                      : m.uptimePct >= 95
                        ? "text-chart-hist-warn"
                        : "text-destructive";

                return (
                  <li
                    key={m.id}
                    className="motion-enter rounded-2xl border border-border bg-bg-card p-4 shadow-sm transition-[border-color,box-shadow] duration-200 [transition-timing-function:var(--motion-ease-out-quart)] hover:border-border-muted dark:shadow-none dark:hover:border-border"
                    style={
                      {
                        "--enter-delay": `${80 + idx * 45}ms`,
                      } as CSSProperties
                    }
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                      <div className="flex min-w-0 flex-1 gap-3">
                        {favicon ? (
                          <Image
                            src={favicon}
                            alt=""
                            className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-border/80 bg-bg-page object-contain p-0.5"
                            width={36}
                            height={36}
                            unoptimized
                          />
                        ) : (
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-page text-text-muted"
                            aria-hidden
                          >
                            <Globe className="h-4 w-4 opacity-70" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug text-text-primary">{m.name}</p>
                          <p className="mt-1 break-all text-xs leading-relaxed text-text-muted">
                            {m.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end sm:text-right">
                        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-page px-2.5 py-1 text-xs font-medium">
                          {inMaintenance ? (
                            <>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-chart-hist-warn"
                                aria-hidden
                              />
                              <span className="text-chart-hist-warn">{tPublic("statusMaintenance")}</span>
                            </>
                          ) : isUp ? (
                            <>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-primary motion-safe:animate-operational-badge-dot"
                                aria-hidden
                              />
                              <span className="text-primary">{tPublic("statusOperational")}</span>
                            </>
                          ) : isDown ? (
                            <>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-destructive"
                                aria-hidden
                              />
                              <span className="text-destructive">{tPublic("statusUnavailable")}</span>
                            </>
                          ) : (
                            <>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-border"
                                aria-hidden
                              />
                              <span className="text-text-muted">{tPublic("statusNoData")}</span>
                            </>
                          )}
                        </span>
                        {inMaintenance && m.maintenanceNote && (
                          <span className="max-w-[14rem] text-[0.65rem] text-text-muted">
                            {m.maintenanceNote}
                          </span>
                        )}
                        <span className="text-[0.65rem] tabular-nums text-text-muted sm:max-w-[14rem]">
                          {tPublic("checked")}{" "}
                          {m.lastCheckAt ? (
                            <time dateTime={m.lastCheckAt}>
                              {formatRelativeTime(m.lastCheckAt)}
                            </time>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>

                    {m.checkCount90d > 0 && (
                      <div className="mt-4 border-t border-border/80 pt-4">
                        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
                          {tPublic("history90d")}
                          <span className="ml-1 font-normal normal-case text-text-muted/90">
                            {tPublic("historySegmentHint")}
                          </span>
                        </p>
                        <div
                          className="flex h-8 gap-px rounded-md bg-border/40 p-px"
                          role="img"
                          aria-label={tPublic("historyAria")}
                        >
                          {m.buckets.map((b, i) => {
                            const pct = b.total > 0 ? b.ok / b.total : -1;
                            const barClass =
                              pct < 0
                                ? "bg-border"
                                : pct >= 1
                                  ? "bg-primary"
                                  : pct >= 0.9
                                    ? "bg-chart-hist-warn"
                                    : "bg-destructive";
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "min-w-[3px] flex-1 rounded-[2px] transition-opacity duration-150 hover:opacity-80",
                                  barClass
                                )}
                                title={
                                  pct < 0
                                    ? tPublic("noData")
                                    : tPublic("successfulChecksTitle", { percent: Math.round(pct * 100) })
                                }
                              />
                            );
                          })}
                        </div>
                        <div className="mt-2 flex justify-between text-[0.65rem] text-text-muted">
                          <span>{tPublic("older")}</span>
                          <span>{tPublic("recent")}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      {m.uptimePct !== null && (
                        <span className={cn("font-medium", uptimeColor)}>
                          {tPublic("uptimePercent", { percent: m.uptimePct })}
                        </span>
                      )}
                      {m.uptimePct !== null && m.avgResponseTimeMs !== null && (
                        <span aria-hidden className="text-border">
                          ·
                        </span>
                      )}
                      {m.avgResponseTimeMs !== null && (
                        <span>
                          <span className="font-medium text-text-primary">
                            {m.avgResponseTimeMs}ms
                          </span>{" "}
                          {tPublic("avgResponse")}
                        </span>
                      )}
                      {(m.uptimePct !== null || m.avgResponseTimeMs !== null) &&
                        m.checkCount90d > 0 && (
                          <span aria-hidden className="text-border">
                            ·
                          </span>
                        )}
                      {m.checkCount90d > 0 && (
                        <span>{tPublic("checksSampled", { count: m.checkCount90d.toLocaleString() })}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {incidents.length > 0 && (
          <section
            className="mt-10 rounded-2xl border border-destructive/25 bg-destructive/5 p-5 sm:p-6"
            aria-label={tPublic("activeIncidents")}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/12 text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  className="text-base font-semibold text-destructive"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {tPublic("activeIncidents")}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {tPublic("activeIncidentsBody")}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {incidents.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-col gap-2 rounded-xl border border-destructive/20 bg-bg-card/80 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="font-medium">{m.name}</span>
                        </div>
                        {(m.lastErrorCode != null || m.lastErrorMessage) && (
                          <p
                            className="mt-2 pl-6 text-xs leading-relaxed text-text-muted"
                            title={[
                              m.lastErrorCode != null ? `HTTP ${m.lastErrorCode}` : null,
                              m.lastErrorMessage,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          >
                            {m.lastErrorCode != null ? `HTTP ${m.lastErrorCode}` : ""}
                            {m.lastErrorCode != null && m.lastErrorMessage ? " · " : ""}
                            {m.lastErrorMessage ?? ""}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 pl-6 text-xs tabular-nums text-text-muted sm:pl-0 sm:text-right">
                        {m.lastStatusChangedAt
                          ? tPublic("unhealthyFor", { duration: formatDuration(m.lastStatusChangedAt) })
                          : tPublic("unhealthy")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {!isLoggedIn && (
          <section
            className="mt-12 rounded-2xl border border-border bg-bg-card p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6 dark:shadow-none"
            aria-labelledby="public-status-guest-cta-heading"
          >
            <div className="min-w-0">
              <h2
                id="public-status-guest-cta-heading"
                className="text-base font-semibold text-text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tPublic("guestCtaHeading")}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                {tPublic("guestCtaBody")}
              </p>
            </div>
            <div className="mt-4 shrink-0 sm:mt-0">
              <Link
                href="/"
                aria-label={tPublic("guestCtaButtonAria")}
                className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-bg-page transition-colors hover:bg-accent-hover sm:w-auto"
              >
                {tPublic("guestCtaButton")}
              </Link>
            </div>
          </section>
        )}

        <footer className="mt-14 border-t border-border pt-8">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-text-muted">
            {showPoweredBy && (
              <>
                <span>
                  {tPublic("poweredBy")}{" "}
                  <Link
                    href="/"
                    className="font-medium text-text-primary underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    UPG Monitor
                  </Link>
                </span>
                <span aria-hidden className="text-border">
                  ·
                </span>
              </>
            )}
            <span>{tPublic("autoRefresh")}</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
