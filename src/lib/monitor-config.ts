import type { Monitor } from "@/db/schema";
import {
  HTTP_METHODS,
  REQUEST_BODY_TYPES,
  validateDnsRecordType,
  validateEmail,
  validateExpectedStatusCodes,
  validateHttpMethod,
  validateKeywordContains,
  validateMaintenanceWindow,
  validateMonitorHostname,
  validateMonitorName,
  validateMonitorUrl,
  validateRequestBody,
  validateRequestBodyType,
  validateTcpPort,
  type HttpMethod,
  type RequestBodyType,
} from "@/lib/validate-monitor";

export const MONITOR_TYPES = ["http", "keyword", "dns", "tcp"] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export type RequestHeader = {
  name: string;
  value: string;
};

export type ParsedMonitorConfig = {
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
  alertEmail: boolean;
  alertEmailTo: string | null;
  sslMonitoring: boolean;
  showOnStatusPage: boolean;
  paused?: boolean;
  type: MonitorType;
  keywordContains: string | null;
  keywordShouldExist: boolean | null;
  dnsRecordType: string | null;
  dnsExpectedValue: string | null;
  tcpHost: string | null;
  tcpPort: number | null;
  maintenanceStartsAt: Date | null;
  maintenanceEndsAt: Date | null;
  maintenanceNote: string | null;
  degradationAlertEnabled: boolean;
};

export type ParseMonitorConfigResult =
  | { ok: true; config: ParsedMonitorConfig }
  | { ok: false; error: string };

const BLOCKED_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseMonitorType(value: unknown, fallback: MonitorType = "http"): MonitorType {
  return MONITOR_TYPES.includes(value as MonitorType) ? (value as MonitorType) : fallback;
}

function parseHttpMethod(value: unknown, fallback: HttpMethod = "GET"): HttpMethod {
  return HTTP_METHODS.includes(value as HttpMethod) ? (value as HttpMethod) : fallback;
}

function parseRequestBodyType(value: unknown, fallback: RequestBodyType = "none"): RequestBodyType {
  return REQUEST_BODY_TYPES.includes(value as RequestBodyType) ? (value as RequestBodyType) : fallback;
}

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) return fallback;
  return Math.min(Math.round(value), max);
}

function parseOptionalDate(value: unknown, fallback: Date | null = null): Date | null {
  if (value === null || value === "") return null;
  if (value === undefined) return fallback;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }
  return fallback;
}

function normalizeHeaderName(name: string): string {
  return name
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

export function parseRequestHeadersInput(value: unknown): { ok: true; headers: RequestHeader[] } | { ok: false; error: string } {
  const rawEntries: RequestHeader[] = [];

  if (value == null || value === "") {
    return { ok: true, headers: [] };
  }

  if (typeof value === "string") {
    try {
      return parseRequestHeadersInput(JSON.parse(value));
    } catch {
      return { ok: false, error: "Request headers must be valid JSON" };
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isObject(item)) return { ok: false, error: "Each request header must be an object" };
      rawEntries.push({
        name: stringField(item.name),
        value: typeof item.value === "string" ? item.value : "",
      });
    }
  } else if (isObject(value)) {
    for (const [name, headerValue] of Object.entries(value)) {
      rawEntries.push({ name: name.trim(), value: String(headerValue ?? "") });
    }
  } else {
    return { ok: false, error: "Request headers must be an array or object" };
  }

  const headers = rawEntries.filter((h) => h.name || h.value);
  if (headers.length > 20) return { ok: false, error: "At most 20 request headers are allowed" };

  const seen = new Set<string>();
  const normalized: RequestHeader[] = [];
  for (const header of headers) {
    const name = header.name.trim();
    const value = header.value;
    const lower = name.toLowerCase();
    if (!name) return { ok: false, error: "Request header name is required" };
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) {
      return { ok: false, error: `Request header "${name}" is not valid` };
    }
    if (name.length > 80) return { ok: false, error: "Request header names must be at most 80 characters" };
    if (value.length > 2048) return { ok: false, error: "Request header values must be at most 2048 characters" };
    if (BLOCKED_REQUEST_HEADERS.has(lower) || lower.startsWith("sec-")) {
      return { ok: false, error: `Request header "${name}" is managed by the checker and cannot be set` };
    }
    if (seen.has(lower)) return { ok: false, error: `Duplicate request header "${name}"` };
    seen.add(lower);
    normalized.push({ name: normalizeHeaderName(name), value });
  }

  return { ok: true, headers: normalized };
}

export function serializeRequestHeaders(headers: RequestHeader[]): string {
  return JSON.stringify(headers);
}

export function parseStoredRequestHeaders(value: string | null | undefined): RequestHeader[] {
  const parsed = parseRequestHeadersInput(value ?? "[]");
  return parsed.ok ? parsed.headers : [];
}

export function redactRequestHeaders(value: string | null | undefined): RequestHeader[] {
  return parseStoredRequestHeaders(value).map((header) => ({
    name: header.name,
    value: SENSITIVE_HEADER_NAMES.has(header.name.toLowerCase()) ? "[redacted]" : header.value,
  }));
}

export function isMaintenanceActive(
  monitorLike: Pick<Monitor, "maintenanceStartsAt" | "maintenanceEndsAt">,
  now: Date = new Date()
): boolean {
  const startsAt = monitorLike.maintenanceStartsAt;
  const endsAt = monitorLike.maintenanceEndsAt;
  return !!startsAt && !!endsAt && startsAt.getTime() <= now.getTime() && endsAt.getTime() > now.getTime();
}

export function parseMonitorConfigForCreate(input: Record<string, unknown>): ParseMonitorConfigResult {
  return parseMonitorConfig(input, {});
}

export function parseMonitorConfigForUpdate(
  input: Record<string, unknown>,
  existing: Monitor
): ParseMonitorConfigResult {
  return parseMonitorConfig(input, { existing });
}

function parseMonitorConfig(
  input: Record<string, unknown>,
  opts: { existing?: Monitor }
): ParseMonitorConfigResult {
  const existing = opts.existing;
  const type = existing ? (existing.type ?? "http") : parseMonitorType(input.type);

  const name = stringField(input.name, existing?.name ?? "");
  const url = stringField(input.url, existing?.url ?? "");
  const intervalMinutes = parseNumber(input.intervalMinutes, existing?.intervalMinutes ?? 5, 1, 60);
  const timeoutSeconds = parseNumber(input.timeoutSeconds, existing?.timeoutSeconds ?? 15, 5, 120);
  const rawMethod = type === "keyword" ? "GET" : parseHttpMethod(input.method, existing?.method ?? "GET");
  const method = type === "dns" || type === "tcp" ? "GET" : rawMethod;
  const expectedStatusCodes = stringField(input.expectedStatusCodes, existing?.expectedStatusCodes ?? "200-299") || "200-299";
  const alertEmail = typeof input.alertEmail === "boolean" ? input.alertEmail : !!existing?.alertEmail;
  const alertEmailTo =
    typeof input.alertEmailTo === "string" && input.alertEmailTo.trim()
      ? input.alertEmailTo.trim()
      : input.alertEmailTo === null
        ? null
        : existing?.alertEmailTo ?? null;
  const showOnStatusPage =
    typeof input.showOnStatusPage === "boolean"
      ? input.showOnStatusPage
      : existing?.showOnStatusPage !== false;
  const paused =
    typeof input.paused === "boolean" ? input.paused : existing ? !!existing.paused : undefined;

  const requestHeadersInput = input.requestHeaders !== undefined ? input.requestHeaders : existing?.requestHeaders ?? "[]";
  const parsedHeaders = parseRequestHeadersInput(requestHeadersInput);
  if (!parsedHeaders.ok) return parsedHeaders;

  const requestBody =
    typeof input.requestBody === "string"
      ? input.requestBody
      : input.requestBody === null
        ? null
        : existing?.requestBody ?? null;
  const requestBodyType = requestBody ? parseRequestBodyType(input.requestBodyType, existing?.requestBodyType ?? "text") : "none";
  const followRedirects =
    typeof input.followRedirects === "boolean"
      ? input.followRedirects
      : existing?.followRedirects !== false;
  const maxRedirects = parseNumber(input.maxRedirects, existing?.maxRedirects ?? 20, 0, 20);

  const keywordContains =
    type === "keyword"
      ? stringField(input.keywordContains, existing?.keywordContains ?? "") || null
      : null;
  const keywordShouldExist =
    type === "keyword"
      ? typeof input.keywordShouldExist === "boolean"
        ? input.keywordShouldExist
        : existing?.keywordShouldExist !== false
      : null;
  const dnsRecordType =
    type === "dns"
      ? stringField(input.dnsRecordType, existing?.dnsRecordType ?? "A").toUpperCase()
      : null;
  const dnsExpectedValue =
    type === "dns"
      ? stringField(input.dnsExpectedValue, existing?.dnsExpectedValue ?? "") || null
      : null;
  const tcpHost =
    type === "tcp"
      ? stringField(input.tcpHost, existing?.tcpHost ?? url) || url
      : null;
  const tcpPort =
    type === "tcp"
      ? typeof input.tcpPort === "number"
        ? Math.round(input.tcpPort)
        : existing?.tcpPort ?? null
      : null;

  const sslMonitoring = type === "http" || type === "keyword" ? input.sslMonitoring === true || (input.sslMonitoring === undefined && !!existing?.sslMonitoring) : false;
  const degradationAlertEnabled =
    type === "http" || type === "keyword"
      ? input.degradationAlertEnabled === true || (input.degradationAlertEnabled === undefined && !!existing?.degradationAlertEnabled)
      : false;

  const maintenanceStartsAt = parseOptionalDate(input.maintenanceStartsAt, existing?.maintenanceStartsAt ?? null);
  const maintenanceEndsAt = parseOptionalDate(input.maintenanceEndsAt, existing?.maintenanceEndsAt ?? null);
  const maintenanceNote =
    typeof input.maintenanceNote === "string"
      ? input.maintenanceNote.trim() || null
      : input.maintenanceNote === null
        ? null
        : existing?.maintenanceNote ?? null;

  if (!name) return { ok: false, error: "Name is required" };
  const nameError = validateMonitorName(name);
  if (nameError) return { ok: false, error: nameError };

  const methodError = validateHttpMethod(method);
  if (methodError) return { ok: false, error: methodError };
  const bodyTypeError = validateRequestBodyType(requestBodyType);
  if (bodyTypeError) return { ok: false, error: bodyTypeError };
  const bodyError = validateRequestBody(requestBody);
  if (bodyError) return { ok: false, error: bodyError };
  if ((method === "GET" || method === "HEAD") && requestBody) {
    return { ok: false, error: "Request body is only allowed for POST, PUT, or PATCH checks" };
  }
  if (requestBodyType === "json" && requestBody) {
    try {
      JSON.parse(requestBody);
    } catch {
      return { ok: false, error: "JSON request body must be valid JSON" };
    }
  }

  if (type === "dns") {
    if (!url) return { ok: false, error: "Hostname is required" };
    const hostnameError = validateMonitorHostname(url);
    if (hostnameError) return { ok: false, error: hostnameError };
    if (!dnsRecordType) return { ok: false, error: "DNS record type is required" };
    const recordTypeError = validateDnsRecordType(dnsRecordType);
    if (recordTypeError) return { ok: false, error: recordTypeError };
    if (!dnsExpectedValue) return { ok: false, error: "Expected value is required for DNS monitors" };
  } else if (type === "tcp") {
    if (!tcpHost) return { ok: false, error: "TCP host is required" };
    const hostnameError = validateMonitorHostname(tcpHost);
    if (hostnameError) return { ok: false, error: hostnameError };
    if (tcpPort == null) return { ok: false, error: "TCP port is required" };
    const portError = validateTcpPort(tcpPort);
    if (portError) return { ok: false, error: portError };
  } else {
    if (!url) return { ok: false, error: "URL is required" };
    const urlError = validateMonitorUrl(url);
    if (urlError) return { ok: false, error: urlError };
    const codesError = validateExpectedStatusCodes(expectedStatusCodes);
    if (codesError) return { ok: false, error: codesError };
  }

  if (type === "keyword") {
    const kwError = validateKeywordContains(keywordContains ?? "");
    if (kwError) return { ok: false, error: kwError };
  }
  if (alertEmailTo) {
    const emailError = validateEmail(alertEmailTo);
    if (emailError) return { ok: false, error: `Alert email: ${emailError}` };
  }
  const maintenanceError = validateMaintenanceWindow(maintenanceStartsAt, maintenanceEndsAt, maintenanceNote);
  if (maintenanceError) return { ok: false, error: maintenanceError };

  return {
    ok: true,
    config: {
      name,
      url: type === "tcp" ? tcpHost ?? "" : url,
      intervalMinutes,
      timeoutSeconds,
      method,
      expectedStatusCodes,
      requestHeaders: serializeRequestHeaders(parsedHeaders.headers),
      requestBody: requestBodyType === "none" ? null : requestBody,
      requestBodyType: requestBody ? requestBodyType : "none",
      followRedirects,
      maxRedirects,
      alertEmail,
      alertEmailTo,
      sslMonitoring,
      showOnStatusPage,
      paused,
      type,
      keywordContains,
      keywordShouldExist,
      dnsRecordType,
      dnsExpectedValue,
      tcpHost,
      tcpPort,
      maintenanceStartsAt,
      maintenanceEndsAt,
      maintenanceNote,
      degradationAlertEnabled,
    },
  };
}
