export const MAX_URL_LENGTH = 2048;
export const MAX_NAME_LENGTH = 200;
export const MAX_JSON_BODY_BYTES = 16 * 1024;

/**
 * Validates expectedStatusCodes format: comma-separated codes or ranges (e.g. "200", "200,201", "200-299").
 * Codes must be in 100-599. Returns error message or null if valid.
 */
export function validateExpectedStatusCodes(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (Number.isNaN(a) || Number.isNaN(b) || a < 100 || a > 599 || b < 100 || b > 599 || a > b) {
        return "expectedStatusCodes: ranges must be 100-599 with min ≤ max";
      }
    } else {
      const code = parseInt(part, 10);
      if (Number.isNaN(code) || code < 100 || code > 599) {
        return "expectedStatusCodes: each code must be 100-599";
      }
    }
  }
  return null;
}

/**
 * Validates URL: must be http or https and within length limit. Returns error or null.
 */
export function validateMonitorUrl(url: string): string | null {
  if (url.length > MAX_URL_LENGTH) {
    return `URL must be at most ${MAX_URL_LENGTH} characters`;
  }
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return "Only HTTP and HTTPS URLs are allowed";
    }
  } catch {
    return "Invalid URL";
  }
  return null;
}

export function validateMonitorName(name: string): string | null {
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be at most ${MAX_NAME_LENGTH} characters`;
  }
  return null;
}

/**
 * Validates an email address format. Returns error message or null.
 */
export function validateEmail(email: string): string | null {
  // Simple but practical email validation
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) {
    return "Invalid email address";
  }
  return null;
}

/** Maximum hostname length per RFC 1035 */
export const MAX_HOSTNAME_LENGTH = 253;
/** Maximum keyword length for keyword monitors */
export const MAX_KEYWORD_LENGTH = 500;

/** Allowed DNS record types */
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/**
 * Validates a bare hostname for DNS monitors (no protocol).
 * Returns error message or null.
 */
export function validateMonitorHostname(hostname: string): string | null {
  if (!hostname || hostname.trim().length === 0) return "Hostname is required";
  if (hostname.length > MAX_HOSTNAME_LENGTH)
    return `Hostname must be at most ${MAX_HOSTNAME_LENGTH} characters`;
  if (/^https?:\/\//i.test(hostname))
    return "Enter a hostname only, without https://";
  const labels = hostname.split(".");
  const labelRe = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
  for (const label of labels) {
    if (!labelRe.test(label))
      return `Invalid hostname: "${label}" is not a valid label`;
  }
  return null;
}

/**
 * Validates a DNS record type. Returns error message or null.
 */
export function validateDnsRecordType(value: string): string | null {
  if (!DNS_RECORD_TYPES.includes(value as DnsRecordType))
    return `Record type must be one of: ${DNS_RECORD_TYPES.join(", ")}`;
  return null;
}

/**
 * Validates the keyword for keyword monitors. Returns error message or null.
 */
export function validateKeywordContains(value: string): string | null {
  if (!value || value.trim().length === 0) return "Keyword is required";
  if (value.length > MAX_KEYWORD_LENGTH)
    return `Keyword must be at most ${MAX_KEYWORD_LENGTH} characters`;
  return null;
}

/**
 * Max request body size for bulk monitor creation (one request, many URLs).
 */
export const MAX_BULK_JSON_BODY_BYTES = 64 * 1024;

/**
 * Check Content-Length for body size limit. Returns error message or null.
 * @param request - the incoming request
 * @param limitBytes - optional custom limit (default MAX_JSON_BODY_BYTES)
 */
export function checkBodySizeLimit(
  request: Request,
  limitBytes?: number
): string | null {
  const limit = limitBytes ?? MAX_JSON_BODY_BYTES;
  const cl = request.headers.get("content-length");
  if (cl === null) return null;
  const n = parseInt(cl, 10);
  if (Number.isNaN(n) || n < 0) return null;
  if (n > limit) {
    return `Request body must be at most ${limit} bytes`;
  }
  return null;
}
