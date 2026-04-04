import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { MonitorDetailActions } from "@/components/monitor-detail-actions";
import { CheckResultsTable } from "@/components/check-results-table";
import { RecentIncidentsList } from "@/components/recent-incidents-list";
import { UptimeTrendCharts } from "@/components/uptime-trend-charts-client";
import { AutoRefresh } from "@/components/auto-refresh";
import { DegradationAlertCallout } from "@/components/degradation-alert-callout";
import { unixNowMs } from "@/lib/server-relative-time";
import { getTranslations } from "next-intl/server";

function getFaviconUrl(url: string, monitorType?: string | null): string {
  if (monitorType === "dns") return "";
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

export default async function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

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
  const incidentCount = results.filter((r) => !r.ok).length;
  const latestResult = results[0] ?? null;
  const lastOk = latestResult ? latestResult.ok : null;

  const responseTimes = results
    .map((r) => r.responseTimeMs)
    .filter((ms): ms is number => ms != null);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  const uptimePct =
    results.length > 0
      ? Math.round((results.filter((r) => r.ok).length / results.length) * 100)
      : null;

  const monitorType = m.type ?? "http";
  const favicon = getFaviconUrl(m.url, monitorType);
  const allMessagesNull = serializedResults.every((r) => r.message === null);

  const t = await getTranslations("monitorDetail");

  return (
    <div>
      <AutoRefresh />
      {/* Breadcrumb */}
      <Link
        href="/monitors"
        className="text-sm text-text-muted hover:text-text-primary"
      >
        ← {t("breadcrumb")}
      </Link>

      {/* Header: favicon + name + status + actions */}
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="h-6 w-6 shrink-0 rounded"
                width={24}
                height={24}
              />
            )}
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
          {monitorType === "dns" ? (
            <p className="mt-1 break-all font-mono text-sm text-text-muted">{m.url}</p>
          ) : (
            <p className="mt-1 break-all text-sm text-text-muted">{m.url}</p>
          )}
          {/* Config meta */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {monitorType !== "dns" && (
              <>
                <span>{monitorType === "keyword" ? "GET" : m.method}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{t("configEvery", { n: m.intervalMinutes })}</span>
            {monitorType !== "dns" && (
              <>
                <span aria-hidden>·</span>
                <span>{t("configTimeout", { n: m.timeoutSeconds })}</span>
                <span aria-hidden>·</span>
                <span>{t("configExpect", { codes: m.expectedStatusCodes })}</span>
                <span aria-hidden>·</span>
                <span>{m.sslMonitoring ? t("configSslOn") : t("configSslOff")}</span>
              </>
            )}
            {monitorType === "keyword" && m.keywordContains && (
              <>
                <span aria-hidden>·</span>
                <span>
                  Keyword: &ldquo;{m.keywordContains}&rdquo;{" "}
                  ({m.keywordShouldExist !== false ? t("configMustContain") : t("configMustNotContain")})
                </span>
              </>
            )}
            {monitorType === "dns" && (
              <>
                <span aria-hidden>·</span>
                <span>{m.dnsRecordType} → {m.dnsExpectedValue}</span>
              </>
            )}
          </div>
        </div>
        <MonitorDetailActions monitor={m} />
      </div>

      {/* Stats grid */}
      {results.length > 0 && (
        <div className={`mt-5 grid grid-cols-2 gap-3 ${m.sslMonitoring ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}>
          <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
            <p className="text-xs text-text-muted">{t("statUptime")}</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                uptimePct === 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : uptimePct != null && uptimePct >= 90
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {uptimePct}%
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {t("statChecks", { n: results.length })}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
            <p className="text-xs text-text-muted">{t("statAvgResponse")}</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {avgResponseTimeMs != null ? `${avgResponseTimeMs}ms` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{t("statLast50")}</p>
          </div>

          <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
            <p className="text-xs text-text-muted">{t("statLatestResponse")}</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {latestResult?.responseTimeMs != null
                ? `${latestResult.responseTimeMs}ms`
                : "—"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{t("statMostRecent")}</p>
          </div>

          <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
            <p className="text-xs text-text-muted">{t("statIncidents")}</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                incidentCount > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {incidentCount > 0 ? incidentCount : t("statNone")}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{t("statInLast50")}</p>
          </div>

          {m.sslMonitoring && (() => {
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
              <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
                <p className="text-xs text-text-muted">{t("statSsl")}</p>
                <p className={`mt-1 text-xl font-semibold ${sslColor}`}>
                  {sslLabel}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {sslDays !== null
                    ? t("sslDaysUntilExpiry", { n: sslDays })
                    : m.sslLastCheckedAt
                      ? t("sslChecked")
                      : t("sslNotCheckedYet")}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Degradation alert callout — shown for HTTP/keyword monitors that haven't enabled it */}
      {m.type !== "dns" && !m.degradationAlertEnabled && (
        <DegradationAlertCallout
          monitorId={m.id}
          hasEmailAlerts={!!m.alertEmail}
        />
      )}

      {/* Recent incidents — only shown when there are failures */}
      {recentIncidents.length > 0 && (
        <section
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10"
          aria-label={t("incidentsTitle")}
        >
          <h2 className="text-sm font-medium text-red-800 dark:text-red-400">
            {t("incidentsTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-red-700/60 dark:text-red-400/60">
            {t("incidentsSubtitle")}
          </p>
          <RecentIncidentsList incidents={recentIncidents} />
        </section>
      )}

      {/* History charts */}
      <section
        className="mt-5 rounded-lg border border-border bg-bg-card p-5 sm:p-6"
        aria-label={t("historyTitle")}
      >
        <h2 className="text-base font-medium text-text-primary">{t("historyTitle")}</h2>
        <p className="mt-0.5 text-sm text-text-muted">{t("historySubtitle")}</p>
        <UptimeTrendCharts
          results={serializedResults}
          baselineP75Ms={m.baselineP75Ms}
          degradationAlertEnabled={m.degradationAlertEnabled}
        />
      </section>

      {/* Check log */}
      <section className="mt-5 rounded-lg border border-border bg-bg-card p-5 sm:p-6">
        <h2 className="text-base font-medium text-text-primary">{t("checkLogTitle")}</h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {results.length === 1
            ? t("checkLogSubtitle", { n: m.intervalMinutes, count: results.length })
            : t("checkLogSubtitlePlural", { n: m.intervalMinutes, count: results.length })}
        </p>
        {results.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border-muted bg-bg-page p-8 text-center text-sm text-text-muted">
            {t("checkLogEmpty")}
          </div>
        ) : (
          <CheckResultsTable
            results={serializedResults}
            hideMessage={allMessagesNull}
          />
        )}
      </section>
    </div>
  );
}
