import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { MonitorDetailActions } from "@/components/monitor-detail-actions";
import { CheckResultsTable } from "@/components/check-results-table";
import { RecentIncidentsList } from "@/components/recent-incidents-list";
import { MonitorDetailHistoryClient } from "@/components/uptime-trend-charts-client";
import { AutoRefresh } from "@/components/auto-refresh";
import { NextCheckCountdown } from "@/components/next-check-countdown";
import { DegradationAlertCallout } from "@/components/degradation-alert-callout";
import { unixNowMs } from "@/lib/server-relative-time";
import { getTranslations } from "next-intl/server";
import { isDowntimeAcked } from "@/lib/downtime-ack";
import { DowntimeAckControls } from "@/components/downtime-ack-controls";
import { MonitorDetailAckFeedback } from "@/components/monitor-detail-ack-feedback";
import { MonitorFavicon } from "@/components/monitor-favicon";
import { MonitorStatusBadge } from "@/components/monitor-status-badge";

function getFaviconUrl(url: string, monitorType?: string | null): string {
  if (monitorType === "dns" || monitorType === "tcp") return "";
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

function monitorOpenHref(url: string, monitorType: string): string {
  if (monitorType === "dns" || monitorType === "tcp") {
    const host = url.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? url;
    return host ? `https://${host}` : url;
  }
  return url;
}

const chipClass =
  "inline-flex max-w-full rounded-md bg-bg-page px-2 py-0.5 text-[11px] font-medium text-text-muted";

export default async function MonitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ack?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const sp = await searchParams;

  if (!session?.user?.id) {
    const qs = new URLSearchParams();
    if (sp.ack) qs.set("ack", sp.ack);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/monitors/${id}${suffix}`)}`
    );
  }

  const [[m], results] = await Promise.all([
    db.select().from(monitor).where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id))),
    db
      .select()
      .from(checkResult)
      .where(eq(checkResult.monitorId, id))
      .orderBy(desc(checkResult.createdAt))
      .limit(50),
  ]);
  if (!m) notFound();

  const serializedResults = results.map((r) => ({
    id: r.id,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt).toISOString(),
    ok: r.ok,
    statusCode: r.statusCode,
    responseTimeMs: r.responseTimeMs,
    dnsMs: r.dnsMs ?? null,
    connectMs: r.connectMs ?? null,
    tlsMs: r.tlsMs ?? null,
    ttfbMs: r.ttfbMs ?? null,
    attempts: r.attempts ?? null,
    message: r.message,
  }));

  const recentIncidents = serializedResults.filter((r) => !r.ok).slice(0, 5);
  const latestResult = results[0] ?? null;
  const lastOk = latestResult ? latestResult.ok : null;

  const chartRows = serializedResults.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    ok: r.ok,
    responseTimeMs: r.responseTimeMs,
  }));

  const monitorType = m.type ?? "http";
  const favicon = getFaviconUrl(m.url, monitorType);
  const allMessagesNull = serializedResults.every((r) => r.message === null);

  const t = await getTranslations("monitorDetail");
  const showDowntimeAckUi = !m.paused && m.currentStatus === false;

  return (
    <div className="space-y-6">
      <MonitorDetailAckFeedback ackParam={sp.ack} />
      <AutoRefresh />

      {/* Back link */}
      <Link
        href="/monitors"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
        {t("breadcrumb")}
      </Link>

      {/* Hero card */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm">
        <div className="p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {/* Name + status */}
              <div className="flex flex-wrap items-center gap-3">
                {favicon && <MonitorFavicon src={favicon} size="md" />}
                <h1
                  className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {m.name}
                </h1>
                <MonitorStatusBadge
                  paused={!!m.paused}
                  latest={lastOk === null ? undefined : { ok: lastOk }}
                />
              </div>

              {/* URL */}
              <a
                href={monitorOpenHref(m.url, monitorType)}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-2 inline-flex items-center gap-1.5 text-sm text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline ${monitorType === "dns" || monitorType === "tcp" ? "font-mono" : ""}`}
              >
                {m.url}
                <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
              </a>

              {/* Config chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {monitorType !== "dns" && monitorType !== "tcp" && (
                  <span className={chipClass}>
                    {monitorType === "keyword" ? "GET" : m.method}
                  </span>
                )}
                <span className={chipClass}>{t("configEvery", { n: m.intervalMinutes })}</span>
                {monitorType !== "dns" && monitorType !== "tcp" && (
                  <>
                    <span className={chipClass}>{t("configTimeout", { n: m.timeoutSeconds })}</span>
                    <span className={chipClass}>{t("configExpect", { codes: m.expectedStatusCodes })}</span>
                    <span className={chipClass}>
                      {m.sslMonitoring ? t("configSslOn") : t("configSslOff")}
                    </span>
                  </>
                )}
                {monitorType === "keyword" && m.keywordContains && (
                  <span className={chipClass}>
                    {t("configKeywordLabel")}: &ldquo;{m.keywordContains}&rdquo;{" "}
                    ({m.keywordShouldExist !== false ? t("configMustContain") : t("configMustNotContain")})
                  </span>
                )}
                {monitorType === "dns" && (
                  <span className={chipClass}>
                    {m.dnsRecordType} → {m.dnsExpectedValue}
                  </span>
                )}
                {monitorType === "tcp" && (
                  <span className={chipClass}>
                    TCP {m.tcpHost ?? m.url}:{m.tcpPort}
                  </span>
                )}
                {m.maintenanceStartsAt && m.maintenanceEndsAt && (
                  <span className={chipClass}>{t("maintenanceScheduled")}</span>
                )}
              </div>

              <NextCheckCountdown
                monitorId={m.id}
                paused={!!m.paused}
                lastCheckAtIso={m.lastCheckAt ? m.lastCheckAt.toISOString() : null}
                intervalMinutes={m.intervalMinutes}
              />
              <DowntimeAckControls
                monitorId={m.id}
                show={showDowntimeAckUi}
                isAcked={isDowntimeAcked(m)}
              />
            </div>
            <MonitorDetailActions monitor={m} />
          </div>
        </div>
      </div>

      <MonitorDetailHistoryClient
        monitorId={m.id}
        initialResults={chartRows}
        hasSslCard={!!m.sslMonitoring}
        showStatsGrid={results.length > 0}
        baselineP75Ms={m.baselineP75Ms}
        degradationAlertEnabled={m.degradationAlertEnabled}
        aboveCharts={
          <>
            {(m.type === "http" || m.type === "keyword") && !m.degradationAlertEnabled && (
              <DegradationAlertCallout
                monitorId={m.id}
                hasEmailAlerts={!!m.alertEmail}
              />
            )}
            {recentIncidents.length > 0 && (
              <section
                className="overflow-hidden rounded-2xl border border-status-down/20 bg-status-down-soft shadow-sm"
                aria-label={t("incidentsTitle")}
              >
                <div className="border-b border-status-down/15 px-5 py-3.5">
                  <h2
                    className="text-[11px] font-semibold uppercase tracking-widest text-status-down"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("incidentsTitle")}
                  </h2>
                  <p className="mt-0.5 text-xs text-status-down/70">
                    {t("incidentsSubtitle")}
                  </p>
                </div>
                <div className="p-5">
                  <RecentIncidentsList incidents={recentIncidents} />
                </div>
              </section>
            )}
          </>
        }
      >
        {m.sslMonitoring &&
          (() => {
            const sslDays = m.sslExpiresAt
              ? Math.ceil(
                  (new Date(m.sslExpiresAt).getTime() - unixNowMs()) /
                    (1000 * 60 * 60 * 24)
                )
              : null;
            const sslColor =
              m.sslValid === null
                ? "text-text-muted"
                : !m.sslValid
                  ? "text-status-down"
                  : sslDays !== null && sslDays <= 2
                    ? "text-status-down"
                    : sslDays !== null && sslDays <= 7
                      ? "text-status-warn"
                      : "text-status-up";
            const sslLabel =
              m.sslValid === null
                ? "—"
                : !m.sslValid
                  ? t("sslInvalid")
                  : sslDays !== null && sslDays <= 2
                    ? t("sslCritical")
                    : sslDays !== null && sslDays <= 7
                      ? t("sslExpiring")
                      : t("sslValid");
            return (
              <div className="flex min-h-full flex-col rounded-xl border border-border/60 bg-bg-page/50 px-3 py-3 sm:px-4 sm:py-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                  {t("statSsl")}
                </span>
                <p className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${sslColor}`}>
                  {sslLabel}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {sslDays !== null
                    ? t("sslDaysUntilExpiry", { n: sslDays })
                    : m.sslLastCheckedAt
                      ? t("sslChecked")
                      : t("sslNotCheckedYet")}
                </p>
              </div>
            );
          })()}
      </MonitorDetailHistoryClient>

      {/* Check log */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-bg-card shadow-sm">
        <div className="border-b border-border/60 px-5 py-3.5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest text-text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("checkLogTitle")}
          </h2>
        </div>
        <div className="p-5 md:p-6">
        <p className="text-sm text-text-muted">
          {results.length === 1
            ? t("checkLogSubtitle", { n: m.intervalMinutes, count: results.length })
            : t("checkLogSubtitlePlural", { n: m.intervalMinutes, count: results.length })}
        </p>
        {results.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
            {t("checkLogEmpty")}
          </div>
        ) : (
          <div className="mt-4">
          <CheckResultsTable
            results={serializedResults}
            hideMessage={allMessagesNull}
          />
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
