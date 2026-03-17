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
