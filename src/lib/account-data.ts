import { parseMonitorConfigForCreate } from "@/lib/monitor-config";
import type { HttpMethod, RequestBodyType } from "@/lib/validate-monitor";

/** Bump when the export shape changes incompatibly. */
export const ACCOUNT_DATA_VERSION = 1;

/** Max JSON body for full account import (monitors + check history). */
export const MAX_ACCOUNT_IMPORT_BODY_BYTES = 25 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function toIsoTimestamp(d: Date | null | undefined): string | null {
  if (d == null) return null;
  return d.toISOString();
}

export function parseImportedDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export type AccountExportUser = {
  email: string;
  username: string | null;
  language?: "en" | "es";
  onboardingCompleted: boolean | null;
  onboardingStep: string | null;
  activityClearedAt: string | null;
  activityDismissedIds?: string | null;
  statusPageTitle?: string | null;
  statusPageTagline?: string | null;
  statusPageShowPoweredBy?: boolean;
};

export type AccountExportMonitor = {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  timeoutSeconds: number;
  method: HttpMethod;
  expectedStatusCodes: string;
  requestHeaders?: string;
  requestBody?: string | null;
  requestBodyType?: RequestBodyType;
  followRedirects?: boolean;
  maxRedirects?: number;
  lastCheckAt: string | null;
  currentStatus: boolean | null;
  lastStatusChangedAt: string | null;
  downtimeAckEpisodeAt: string | null;
  alertEmail: boolean;
  alertEmailTo: string | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: string | null;
  sslLastCheckedAt: string | null;
  showOnStatusPage: boolean;
  paused: boolean;
  consecutiveFailures?: number | null;
  type?: "http" | "keyword" | "dns" | "tcp";
  keywordContains?: string | null;
  keywordShouldExist?: boolean;
  dnsRecordType?: string | null;
  dnsExpectedValue?: string | null;
  tcpHost?: string | null;
  tcpPort?: number | null;
  maintenanceStartsAt?: string | null;
  maintenanceEndsAt?: string | null;
  maintenanceNote?: string | null;
  degradationAlertEnabled?: boolean;
  baselineP75Ms?: number | null;
  baselineSampleCount?: number | null;
  consecutiveDegradedChecks?: number | null;
  degradingAlertSentAt?: string | null;
  baselineResetAt?: string | null;
  createdAt: string;
};

export type AccountExportCheckResult = {
  id: string;
  monitorId: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  ok: boolean;
  message: string | null;
  createdAt: string;
};

export type AccountExportPayload = {
  upgAccountExportVersion: typeof ACCOUNT_DATA_VERSION;
  exportedAt: string;
  user: AccountExportUser;
  monitors: AccountExportMonitor[];
  checkResults: AccountExportCheckResult[];
};

export type ParsedMonitorRow = {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  timeoutSeconds: number;
  method: HttpMethod;
  expectedStatusCodes: string;
  requestHeaders: string;
  requestBody: string | null;
  requestBodyType: RequestBodyType;
  followRedirects: boolean;
  maxRedirects: number;
  lastCheckAt: Date | null;
  currentStatus: boolean | null;
  lastStatusChangedAt: Date | null;
  downtimeAckEpisodeAt: Date | null;
  alertEmail: boolean;
  alertEmailTo: string | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: Date | null;
  sslLastCheckedAt: Date | null;
  showOnStatusPage: boolean;
  paused: boolean;
  consecutiveFailures: number | null;
  type: "http" | "keyword" | "dns" | "tcp";
  keywordContains: string | null;
  keywordShouldExist: boolean;
  dnsRecordType: string | null;
  dnsExpectedValue: string | null;
  tcpHost: string | null;
  tcpPort: number | null;
  maintenanceStartsAt: Date | null;
  maintenanceEndsAt: Date | null;
  maintenanceNote: string | null;
  degradationAlertEnabled: boolean;
  baselineP75Ms: number | null;
  baselineSampleCount: number | null;
  consecutiveDegradedChecks: number | null;
  degradingAlertSentAt: Date | null;
  baselineResetAt: Date | null;
  createdAt: Date;
};

export type AccountImportMonitorError = {
  index: number;
  id: string;
  name: string;
  url: string;
  error: string;
};

export function parseMonitorFromImport(
  item: Record<string, unknown>,
  index: number
): { ok: true; row: ParsedMonitorRow } | { ok: false; error: AccountImportMonitorError } {
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const fallbackName = typeof item.name === "string" ? item.name : "";
  const fallbackUrl = typeof item.url === "string" ? item.url : "";
  if (!id || !isUuid(id)) {
    return {
      ok: false,
      error: {
        index: index + 1,
        id,
        name: fallbackName,
        url: fallbackUrl,
        error: "Each monitor must have a valid id (UUID)",
      },
    };
  }

  const parsedConfig = parseMonitorConfigForCreate(item);
  if (!parsedConfig.ok) {
    return {
      ok: false,
      error: {
        index: index + 1,
        id,
        name: fallbackName,
        url: fallbackUrl,
        error: parsedConfig.error,
      },
    };
  }
  const config = parsedConfig.config;
  const paused = item.paused === true;
  const consecutiveFailures =
    typeof item.consecutiveFailures === "number" &&
    Number.isFinite(item.consecutiveFailures)
      ? Math.max(0, Math.round(item.consecutiveFailures))
      : null;
  const degradationAlertEnabled = item.degradationAlertEnabled === true;
  const baselineP75Ms =
    typeof item.baselineP75Ms === "number" && Number.isFinite(item.baselineP75Ms)
      ? Math.max(0, Math.round(item.baselineP75Ms))
      : null;
  const baselineSampleCount =
    typeof item.baselineSampleCount === "number" &&
    Number.isFinite(item.baselineSampleCount)
      ? Math.max(0, Math.round(item.baselineSampleCount))
      : null;
  const consecutiveDegradedChecks =
    typeof item.consecutiveDegradedChecks === "number" &&
    Number.isFinite(item.consecutiveDegradedChecks)
      ? Math.max(0, Math.round(item.consecutiveDegradedChecks))
      : null;

  const lastCheckAt = parseImportedDate(item.lastCheckAt);
  const lastStatusChangedAt = parseImportedDate(item.lastStatusChangedAt);
  const downtimeAckEpisodeAt = parseImportedDate(item.downtimeAckEpisodeAt);
  const sslExpiresAt = parseImportedDate(item.sslExpiresAt);
  const sslLastCheckedAt = parseImportedDate(item.sslLastCheckedAt);
  const maintenanceStartsAt = parseImportedDate(item.maintenanceStartsAt);
  const maintenanceEndsAt = parseImportedDate(item.maintenanceEndsAt);
  const degradingAlertSentAt = parseImportedDate(item.degradingAlertSentAt);
  const baselineResetAt = parseImportedDate(item.baselineResetAt);
  const createdAt = parseImportedDate(item.createdAt);
  if (!createdAt) {
    return {
      ok: false,
      error: {
        index: index + 1,
        id,
        name: config.name,
        url: config.url,
        error: "createdAt is required and must be a valid date",
      },
    };
  }

  const currentStatus =
    typeof item.currentStatus === "boolean" ? item.currentStatus : null;
  const sslValid =
    typeof item.sslValid === "boolean" ? item.sslValid : null;

  return {
    ok: true,
    row: {
      id,
      name: config.name,
      url: config.url,
      intervalMinutes: config.intervalMinutes,
      timeoutSeconds: config.timeoutSeconds,
      method: config.method,
      expectedStatusCodes: config.expectedStatusCodes,
      requestHeaders: config.requestHeaders,
      requestBody: config.requestBody,
      requestBodyType: config.requestBodyType,
      followRedirects: config.followRedirects,
      maxRedirects: config.maxRedirects,
      lastCheckAt,
      currentStatus,
      lastStatusChangedAt,
      downtimeAckEpisodeAt,
      alertEmail: config.alertEmail,
      alertEmailTo: config.alertEmailTo,
      sslMonitoring: config.sslMonitoring,
      sslValid,
      sslExpiresAt,
      sslLastCheckedAt,
      showOnStatusPage: config.showOnStatusPage,
      paused,
      consecutiveFailures,
      type: config.type,
      keywordContains: config.keywordContains,
      keywordShouldExist: config.keywordShouldExist !== false,
      dnsRecordType: config.dnsRecordType,
      dnsExpectedValue: config.dnsExpectedValue,
      tcpHost: config.tcpHost,
      tcpPort: config.tcpPort,
      maintenanceStartsAt,
      maintenanceEndsAt,
      maintenanceNote: config.maintenanceNote,
      degradationAlertEnabled,
      baselineP75Ms,
      baselineSampleCount,
      consecutiveDegradedChecks,
      degradingAlertSentAt,
      baselineResetAt,
      createdAt,
    },
  };
}

export type AccountImportCheckResultError = {
  index: number;
  error: string;
};

export function parseCheckResultFromImport(
  item: Record<string, unknown>,
  index: number,
  monitorIds: Set<string>
):
  | { ok: true; row: { id: string; monitorId: string; statusCode: number | null; responseTimeMs: number | null; ok: boolean; message: string | null; createdAt: Date } }
  | { ok: false; error: AccountImportCheckResultError } {
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!id || !isUuid(id)) {
    return {
      ok: false,
      error: { index: index + 1, error: "check result id must be a UUID" },
    };
  }
  const monitorId =
    typeof item.monitorId === "string" ? item.monitorId.trim() : "";
  if (!monitorId || !monitorIds.has(monitorId)) {
    return {
      ok: false,
      error: {
        index: index + 1,
        error: "check result monitorId must match an imported monitor",
      },
    };
  }
  const statusCode =
    typeof item.statusCode === "number" && Number.isFinite(item.statusCode)
      ? Math.round(item.statusCode)
      : null;
  const responseTimeMs =
    typeof item.responseTimeMs === "number" &&
    Number.isFinite(item.responseTimeMs)
      ? Math.max(0, Math.round(item.responseTimeMs))
      : null;
  if (typeof item.ok !== "boolean") {
    return {
      ok: false,
      error: { index: index + 1, error: "check result ok must be a boolean" },
    };
  }
  const message =
    typeof item.message === "string" && item.message.length > 0
      ? item.message.slice(0, 2000)
      : null;
  const createdAt = parseImportedDate(item.createdAt);
  if (!createdAt) {
    return {
      ok: false,
      error: {
        index: index + 1,
        error: "check result createdAt must be a valid date",
      },
    };
  }
  return {
    ok: true,
    row: {
      id,
      monitorId,
      statusCode,
      responseTimeMs,
      ok: item.ok,
      message,
      createdAt,
    },
  };
}
