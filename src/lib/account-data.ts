import {
  validateEmail,
  validateExpectedStatusCodes,
  validateMonitorName,
  validateMonitorUrl,
} from "@/lib/validate-monitor";

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
  onboardingCompleted: boolean | null;
  onboardingStep: string | null;
  activityClearedAt: string | null;
};

export type AccountExportMonitor = {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  timeoutSeconds: number;
  method: "GET" | "HEAD";
  expectedStatusCodes: string;
  lastCheckAt: string | null;
  currentStatus: boolean | null;
  lastStatusChangedAt: string | null;
  alertEmail: boolean;
  alertEmailTo: string | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: string | null;
  sslLastCheckedAt: string | null;
  showOnStatusPage: boolean;
  paused: boolean;
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
  upgsAccountExportVersion: typeof ACCOUNT_DATA_VERSION;
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
  method: "GET" | "HEAD";
  expectedStatusCodes: string;
  lastCheckAt: Date | null;
  currentStatus: boolean | null;
  lastStatusChangedAt: Date | null;
  alertEmail: boolean;
  alertEmailTo: string | null;
  sslMonitoring: boolean;
  sslValid: boolean | null;
  sslExpiresAt: Date | null;
  sslLastCheckedAt: Date | null;
  showOnStatusPage: boolean;
  paused: boolean;
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
  if (!id || !isUuid(id)) {
    return {
      ok: false,
      error: {
        index: index + 1,
        id,
        name: typeof item.name === "string" ? item.name : "",
        url: typeof item.url === "string" ? item.url : "",
        error: "Each monitor must have a valid id (UUID)",
      },
    };
  }

  const name =
    typeof item.name === "string" && item.name.trim() ? item.name.trim() : "";
  const url =
    typeof item.url === "string" && item.url.trim() ? item.url.trim() : "";

  const nameError = name ? validateMonitorName(name) : "Name is required";
  if (nameError) {
    return {
      ok: false,
      error: { index: index + 1, id, name, url, error: nameError },
    };
  }

  const urlError = url ? validateMonitorUrl(url) : "URL is required";
  if (urlError) {
    return {
      ok: false,
      error: { index: index + 1, id, name, url, error: urlError },
    };
  }

  const expectedStatusCodes =
    typeof item.expectedStatusCodes === "string" &&
    item.expectedStatusCodes.trim()
      ? item.expectedStatusCodes.trim()
      : "200-299";
  const codesError = validateExpectedStatusCodes(expectedStatusCodes);
  if (codesError) {
    return {
      ok: false,
      error: { index: index + 1, id, name, url, error: codesError },
    };
  }

  const alertEmailTo =
    typeof item.alertEmailTo === "string" && item.alertEmailTo.trim()
      ? item.alertEmailTo.trim()
      : null;
  if (alertEmailTo) {
    const emailError = validateEmail(alertEmailTo);
    if (emailError) {
      return {
        ok: false,
        error: {
          index: index + 1,
          id,
          name,
          url,
          error: `Alert email: ${emailError}`,
        },
      };
    }
  }

  const intervalMinutes =
    typeof item.intervalMinutes === "number" && item.intervalMinutes >= 1
      ? Math.min(Math.round(item.intervalMinutes), 60)
      : 5;
  const timeoutSeconds =
    typeof item.timeoutSeconds === "number" && item.timeoutSeconds >= 5
      ? Math.min(Math.round(item.timeoutSeconds), 120)
      : 15;
  const method = item.method === "HEAD" ? "HEAD" : ("GET" as const);
  const alertEmail = item.alertEmail === true;
  const sslMonitoring = item.sslMonitoring === true;
  const showOnStatusPage =
    typeof item.showOnStatusPage === "boolean" ? item.showOnStatusPage : true;
  const paused = item.paused === true;

  const lastCheckAt = parseImportedDate(item.lastCheckAt);
  const lastStatusChangedAt = parseImportedDate(item.lastStatusChangedAt);
  const sslExpiresAt = parseImportedDate(item.sslExpiresAt);
  const sslLastCheckedAt = parseImportedDate(item.sslLastCheckedAt);
  const createdAt = parseImportedDate(item.createdAt);
  if (!createdAt) {
    return {
      ok: false,
      error: {
        index: index + 1,
        id,
        name,
        url,
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
      name,
      url,
      intervalMinutes,
      timeoutSeconds,
      method,
      expectedStatusCodes,
      lastCheckAt,
      currentStatus,
      lastStatusChangedAt,
      alertEmail,
      alertEmailTo,
      sslMonitoring,
      sslValid,
      sslExpiresAt,
      sslLastCheckedAt,
      showOnStatusPage,
      paused,
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
