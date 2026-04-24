import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
import { monitorMetaChipClass } from "@/lib/monitor-ui";
function getFaviconUrl(url: string, monitorType?: string | null): string {
  if (monitorType === "dns" || monitorType === "tcp") return "";
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

/** Absolute href for opening the monitored target in a new tab (DNS/TCP store hostnames only). */
function monitorOpenHref(url: string, monitorType: string): string {
  if (monitorType === "dns" || monitorType === "tcp") {
    const host = url.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? url;
    return host ? `https://${host}` : url;
  }
  return url;
}

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

  // Fetch monitor metadata and check results in parallel — neither depends on the other.
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
    <div className="space-y-8">
      <MonitorDetailAckFeedback ackParam={sp.ack} />
      <AutoRefresh />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div>
          <div className="border-b border-border/80 bg-muted/30 px-4 py-2.5 dark:bg-muted/20 sm:px-5 sm:py-3">
            <p
              className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("heroEyebrow")}
            </p>
          </div>
          <div className="p-4 sm:p-5 md:p-6">
        <Link
          href="/monitors"
          className="mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-muted/50 hover:text-text-primary"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {t("breadcrumb")}
        </Link>

        {/* Header: favicon + name + status + actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {favicon && <MonitorFavicon src={favicon} size="md" />}
              <h1
                className="text-2xl font-semibold tracking-tight text-text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {m.name}
              </h1>
              {m.paused ? (
                <span className="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-border text-text-muted">
                  {t("statusPaused")}
                </span>
              ) : (
                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    lastOk === true
                      ? "bg-emerald-600 text-white dark:bg-emerald-900/40 dark:text-emerald-400"
                      : lastOk === false
                        ? "bg-red-600 text-white dark:bg-red-900/40 dark:text-red-400"
                        : "bg-border text-text-muted"
                  }`}
                >
                  {lastOk === true ? t("statusUp") : lastOk === false ? t("statusDown") : t("statusNoData")}
                </span>
              )}
            </div>
            <a
              href={monitorOpenHref(m.url, monitorType)}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 block break-all text-sm text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline ${monitorType === "dns" || monitorType === "tcp" ? "font-mono" : ""}`}
            >
              {m.url}
            </a>
            {/* Config meta — chips */}
            <div className="mt-1.5 flex flex-wrap gap-2">
              {monitorType !== "dns" && monitorType !== "tcp" && (
                <span className={monitorMetaChipClass}>
                  {monitorType === "keyword" ? "GET" : m.method}
                </span>
              )}
              <span className={monitorMetaChipClass}>{t("configEvery", { n: m.intervalMinutes })}</span>
              {monitorType !== "dns" && monitorType !== "tcp" && (
                <>
                  <span className={monitorMetaChipClass}>{t("configTimeout", { n: m.timeoutSeconds })}</span>
                  <span className={monitorMetaChipClass}>{t("configExpect", { codes: m.expectedStatusCodes })}</span>
                  <span className={monitorMetaChipClass}>
                    {m.sslMonitoring ? t("configSslOn") : t("configSslOff")}
                  </span>
                </>
              )}
              {monitorType === "keyword" && m.keywordContains && (
                <span className={monitorMetaChipClass}>
                  {t("configKeywordLabel")}: &ldquo;{m.keywordContains}&rdquo;{" "}
                  ({m.keywordShouldExist !== false ? t("configMustContain") : t("configMustNotContain")})
                </span>
              )}
              {monitorType === "dns" && (
                <span className={monitorMetaChipClass}>
                  {m.dnsRecordType} → {m.dnsExpectedValue}
                </span>
              )}
              {monitorType === "tcp" && (
                <span className={monitorMetaChipClass}>
                  TCP {m.tcpHost ?? m.url}:{m.tcpPort}
                </span>
              )}
              {m.maintenanceStartsAt && m.maintenanceEndsAt && (
                <span className={monitorMetaChipClass}>Maintenance scheduled</span>
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
                className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm ring-1 ring-red-200/50 dark:border-red-900/35 dark:bg-red-900/10 dark:ring-red-900/25"
                aria-label={t("incidentsTitle")}
              >
                <div className="border-b border-red-200/90 px-4 py-3 dark:border-red-900/40 sm:px-5">
                  <h2
                    className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-red-800 dark:text-red-400"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("incidentsTitle")}
                  </h2>
                  <p className="mt-1 text-xs text-red-700/75 dark:text-red-400/75">
                    {t("incidentsSubtitle")}
                  </p>
                </div>
                <div className="p-4 sm:p-5">
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
                  ? "text-red-600 dark:text-red-400"
                  : sslDays !== null && sslDays <= 7
                    ? "text-red-600 dark:text-red-400"
                    : sslDays !== null && sslDays <= 30
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-emerald-600 dark:text-emerald-400";
            const sslLabel =
              m.sslValid === null
                ? "—"
                : !m.sslValid
                  ? t("sslInvalid")
                  : sslDays !== null && sslDays <= 7
                    ? t("sslCritical")
                    : sslDays !== null && sslDays <= 30
                      ? t("sslExpiring")
                      : t("sslValid");
            return (
              <div className="flex min-h-full flex-col rounded-xl border border-border/80 bg-muted/35 px-3 py-3 dark:bg-muted/20 sm:px-4 sm:py-3.5">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted">
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
      <section className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="border-b border-border/80 bg-gradient-to-b from-muted/40 to-transparent px-4 py-2.5 dark:from-muted/25 sm:px-5 sm:py-3">
          <h2
            className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("checkLogTitle")}
          </h2>
        </div>
        <div className="p-4 sm:p-5 md:p-6">
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
