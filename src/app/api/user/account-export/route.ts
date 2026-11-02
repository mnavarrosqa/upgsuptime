import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { checkResult, monitor, user } from "@/db/schema";
import { and, asc, eq, gt, or } from "drizzle-orm";
import {
  ACCOUNT_DATA_VERSION,
  type AccountExportCheckResult,
  type AccountExportPayload,
  toIsoTimestamp,
} from "@/lib/account-data";
import { redactRequestHeaders } from "@/lib/monitor-config";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeCheckResults =
    url.searchParams.get("includeCheckResults") !== "false";

  const [u] = await db.select().from(user).where(eq(user.id, session.user.id));
  if (!u) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const monitorIds = monitors.map((m) => m.id);

  const payload: Omit<AccountExportPayload, "checkResults"> = {
    upgAccountExportVersion: ACCOUNT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      email: u.email,
      username: u.username ?? null,
      language: u.language === "es" ? "es" : "en",
      onboardingCompleted: u.onboardingCompleted ?? null,
      onboardingStep: u.onboardingStep ?? null,
      activityClearedAt: toIsoTimestamp(u.activityClearedAt ?? undefined),
      activityDismissedIds: u.activityDismissedIds ?? null,
      statusPageTitle: u.statusPageTitle ?? null,
      statusPageTagline: u.statusPageTagline ?? null,
      statusPageShowPoweredBy: u.statusPageShowPoweredBy !== false,
    },
    monitors: monitors.map((m) => ({
      id: m.id,
      name: m.name,
      url: m.url,
      intervalMinutes: m.intervalMinutes,
      timeoutSeconds: m.timeoutSeconds,
      method: m.method,
      expectedStatusCodes: m.expectedStatusCodes,
      requestHeaders: JSON.stringify(redactRequestHeaders(m.requestHeaders)),
      requestBody: null,
      requestBodyType: m.requestBodyType ?? "none",
      followRedirects: m.followRedirects !== false,
      maxRedirects: m.maxRedirects ?? 20,
      lastCheckAt: toIsoTimestamp(m.lastCheckAt ?? undefined),
      currentStatus: m.currentStatus ?? null,
      lastStatusChangedAt: toIsoTimestamp(m.lastStatusChangedAt ?? undefined),
      downtimeAckEpisodeAt: toIsoTimestamp(m.downtimeAckEpisodeAt ?? undefined),
      alertEmail: m.alertEmail ?? false,
      alertEmailTo: m.alertEmailTo ?? null,
      sslMonitoring: m.sslMonitoring ?? false,
      sslValid: m.sslValid ?? null,
      sslExpiresAt: toIsoTimestamp(m.sslExpiresAt ?? undefined),
      sslLastCheckedAt: toIsoTimestamp(m.sslLastCheckedAt ?? undefined),
      showOnStatusPage: m.showOnStatusPage ?? true,
      paused: m.paused ?? false,
      consecutiveFailures: m.consecutiveFailures ?? null,
      type: m.type ?? "http",
      keywordContains: m.keywordContains ?? null,
      keywordShouldExist: m.keywordShouldExist !== false,
      dnsRecordType: m.dnsRecordType ?? null,
      dnsExpectedValue: m.dnsExpectedValue ?? null,
      tcpHost: m.tcpHost ?? null,
      tcpPort: m.tcpPort ?? null,
      maintenanceStartsAt: toIsoTimestamp(m.maintenanceStartsAt ?? undefined),
      maintenanceEndsAt: toIsoTimestamp(m.maintenanceEndsAt ?? undefined),
      maintenanceNote: m.maintenanceNote ?? null,
      degradationAlertEnabled: m.degradationAlertEnabled ?? false,
      baselineP75Ms: m.baselineP75Ms ?? null,
      baselineSampleCount: m.baselineSampleCount ?? null,
      consecutiveDegradedChecks: m.consecutiveDegradedChecks ?? null,
      degradingAlertSentAt: toIsoTimestamp(m.degradingAlertSentAt ?? undefined),
      baselineResetAt: toIsoTimestamp(m.baselineResetAt ?? undefined),
      createdAt: toIsoTimestamp(m.createdAt) ?? new Date().toISOString(),
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `upg-account-${date}.json`;

  // Check history can be hundreds of MB: stream it in pages instead of loading it
  // all (loading it at once ran a 1 GB server out of memory).
  const head = JSON.stringify(payload).slice(0, -1);
  const pending = includeCheckResults ? monitorIds.slice() : [];
  const encoder = new TextEncoder();
  let cursor: { createdAt: Date; id: string } | null = null;
  let first = true;
  let started = false;

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(encoder.encode(`${head},"checkResults":[`));
        return;
      }
      // Each pull must enqueue something (or close): a pull that returns empty-handed
      // is not called again and the download stalls. Skip monitors with no rows.
      for (;;) {
        const monitorId = pending[0];
        if (monitorId === undefined) {
          controller.enqueue(encoder.encode("]}"));
          controller.close();
          return;
        }
        const rows = await db
          .select()
          .from(checkResult)
          .where(
            and(
              eq(checkResult.monitorId, monitorId),
              cursor
                ? or(
                    gt(checkResult.createdAt, cursor.createdAt),
                    and(eq(checkResult.createdAt, cursor.createdAt), gt(checkResult.id, cursor.id)),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(checkResult.createdAt), asc(checkResult.id))
          .limit(EXPORT_PAGE_SIZE);
        if (rows.length < EXPORT_PAGE_SIZE) {
          pending.shift();
          cursor = null;
        } else {
          const last = rows[rows.length - 1];
          cursor = { createdAt: last.createdAt, id: last.id };
        }
        if (rows.length === 0) continue;
        let chunk = "";
        for (const r of rows) {
          chunk += (first ? "" : ",") + JSON.stringify(toExportCheckResult(r));
          first = false;
        }
        controller.enqueue(encoder.encode(chunk));
        return;
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const EXPORT_PAGE_SIZE = 2000;

function toExportCheckResult(r: typeof checkResult.$inferSelect): AccountExportCheckResult {
  return {
    id: r.id,
    monitorId: r.monitorId,
    statusCode: r.statusCode ?? null,
    responseTimeMs: r.responseTimeMs ?? null,
    dnsMs: r.dnsMs ?? null,
    connectMs: r.connectMs ?? null,
    tlsMs: r.tlsMs ?? null,
    ttfbMs: r.ttfbMs ?? null,
    attempts: r.attempts ?? null,
    ok: r.ok,
    message: r.message ?? null,
    duringMaintenance: r.duringMaintenance ?? null,
    createdAt: toIsoTimestamp(r.createdAt) ?? new Date().toISOString(),
  };
}
