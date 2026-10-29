import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { CheckResult, Monitor } from "@/db/schema";
import type { AppLocale } from "@/i18n/config";
import { normalizeLocale } from "@/i18n/config";
import { authenticateMobileRequest, hasBearerToken, type MobileTokens } from "@/lib/mobile-auth";
import { redactRequestHeaders } from "@/lib/monitor-config";
import {
  getRecentChecksByMonitor,
  getUptimeStats90d,
  ninetyDaysAgoFrom,
  uptimePctFromCounts,
} from "@/lib/monitor-public-status";

/**
 * Helpers for the versioned `/api/v1` API used by the native app. Response
 * shapes here are a public contract: add fields, never rename or remove them.
 */

export type ApiUser = {
  id: string;
  email: string;
  username: string | null;
  role: string;
  language: AppLocale;
  /** Set when the request was authenticated with an app access token. */
  sessionId: string | null;
};

/** Token pair as returned by the sign-in and refresh endpoints. */
export function tokenResponse(tokens: MobileTokens) {
  return {
    tokenType: "Bearer",
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    sessionId: tokens.sessionId,
  };
}

export function apiError(status: number, errorCode: string, error?: string): NextResponse {
  return NextResponse.json(error ? { errorCode, error } : { errorCode }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiJson(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: { "Cache-Control": "no-store" } });
}

/**
 * Authenticates a v1 request. A Bearer token is required when the header is
 * present (no silent fallback); otherwise the web session cookie is accepted so
 * the API can be tried from a signed-in browser.
 */
export async function getApiUser(request: Request): Promise<ApiUser | null> {
  if (hasBearerToken(request)) return authenticateMobileRequest(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.name ?? null,
    role: (session.user as { role?: string }).role ?? "user",
    language: normalizeLocale((session.user as { language?: string }).language),
    sessionId: null,
  };
}

export type MonitorStatus = "up" | "down" | "pending" | "paused";

function monitorStatus(m: Pick<Monitor, "paused" | "currentStatus">): MonitorStatus {
  if (m.paused) return "paused";
  if (m.currentStatus === true) return "up";
  if (m.currentStatus === false) return "down";
  return "pending";
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Monitor as listed in the app. */
function toMonitorSummary(m: Monitor) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    url: m.url,
    status: monitorStatus(m),
    paused: !!m.paused,
    intervalMinutes: m.intervalMinutes,
    lastCheckAt: iso(m.lastCheckAt),
    lastStatusChangedAt: iso(m.lastStatusChangedAt),
    downtimeAcknowledged: m.currentStatus === false && m.downtimeAckEpisodeAt != null,
    ssl: m.sslMonitoring
      ? { valid: m.sslValid ?? null, expiresAt: iso(m.sslExpiresAt) }
      : null,
  };
}

/** Full monitor configuration; request header values that look secret are redacted. */
export function toMonitorDetail(m: Monitor) {
  return {
    ...toMonitorSummary(m),
    method: m.method,
    timeoutSeconds: m.timeoutSeconds,
    expectedStatusCodes: m.expectedStatusCodes,
    requestHeaders: redactRequestHeaders(m.requestHeaders),
    followRedirects: m.followRedirects,
    maxRedirects: m.maxRedirects,
    keyword: m.type === "keyword" ? { contains: m.keywordContains, shouldExist: m.keywordShouldExist !== false } : null,
    dns: m.type === "dns" ? { recordType: m.dnsRecordType, expectedValue: m.dnsExpectedValue } : null,
    tcp: m.type === "tcp" ? { host: m.tcpHost, port: m.tcpPort } : null,
    alertEmail: !!m.alertEmail,
    maintenance:
      m.maintenanceStartsAt && m.maintenanceEndsAt
        ? { startsAt: iso(m.maintenanceStartsAt), endsAt: iso(m.maintenanceEndsAt), note: m.maintenanceNote }
        : null,
    createdAt: iso(m.createdAt),
  };
}

export function toCheckResult(r: CheckResult) {
  return {
    id: r.id,
    createdAt: iso(r.createdAt),
    ok: r.ok,
    statusCode: r.statusCode,
    responseTimeMs: r.responseTimeMs,
    timings: {
      dnsMs: r.dnsMs ?? null,
      connectMs: r.connectMs ?? null,
      tlsMs: r.tlsMs ?? null,
      ttfbMs: r.ttfbMs ?? null,
    },
    attempts: r.attempts ?? null,
    message: r.message,
    duringMaintenance: !!r.duringMaintenance,
  };
}

type LatestCheck = { ok: boolean; responseTimeMs: number | null; message: string | null; createdAt: Date };

/** Monitor summary plus its latest check and 90-day uptime, as shown in app lists. */
export function toMonitorListItem(
  m: Monitor,
  latest: LatestCheck | undefined,
  uptime: { total: number; okCount: number } | undefined,
) {
  return {
    ...toMonitorSummary(m),
    latestCheck: latest
      ? {
          ok: latest.ok,
          responseTimeMs: latest.responseTimeMs,
          message: latest.message,
          createdAt: latest.createdAt.toISOString(),
        }
      : null,
    uptime90dPct: uptime ? uptimePctFromCounts(uptime.total, uptime.okCount) : null,
  };
}

/** Latest check and 90-day uptime for a set of monitors, keyed by monitor id. */
export async function loadMonitorStats(monitorIds: string[]) {
  // better-sqlite3 is synchronous, so running these one after the other costs nothing.
  const recent = await getRecentChecksByMonitor(monitorIds, 1);
  const uptime = await getUptimeStats90d(monitorIds, ninetyDaysAgoFrom());
  const latest = new Map<string, LatestCheck>();
  for (const r of recent) if (!latest.has(r.monitorId)) latest.set(r.monitorId, r);
  return { latest, uptime };
}
