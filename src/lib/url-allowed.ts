import { lookup } from "dns/promises";
import { isIPv4, isIPv6 } from "net";

/** Hostnames that must not be used (reserved / metadata). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.",
  "::1",
  "0.0.0.0",
  "metadata",
  "metadata.google",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private 10.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
  if (a === 192 && b === 168) return true; // private 192.168.0.0/16
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  // fe80::/10 link-local
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  // fc00::/7 unique local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export function isBlockedIP(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIPv4(ip);
  if (isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

/**
 * Returns an error message if the URL must not be fetched (SSRF), or null if allowed.
 * Allows only http/https; blocks private/loopback/link-local IPs and reserved hostnames.
 */
export async function getUrlNotAllowedReason(urlString: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return "Invalid URL";
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return "Only HTTP and HTTPS URLs are allowed";
  }

  const hostname = url.hostname.toLowerCase().trim();
  if (!hostname) {
    return "Missing hostname";
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return "URL hostname is not allowed";
  }

  // Hostname that looks like an IP
  if (isIPv4(hostname) || isIPv6(hostname)) {
    if (isBlockedIP(hostname)) {
      return "URL points to a disallowed address";
    }
    return null;
  }

  // Resolve hostname to IP(s) and block if any is private/loopback/link-local
  try {
    const addresses = await lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (isBlockedIP(address)) {
        return "URL resolves to a disallowed address";
      }
    }
  } catch {
    return "Could not resolve hostname";
  }

  return null;
}
