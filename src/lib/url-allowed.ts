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
  const [a, b, c] = parts;
  if (a === 0) return true; // "this network" — 0.0.0.0 reaches localhost on Linux
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT 100.64.0.0/10
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments 192.0.0.0/24
  if (a === 192 && b === 168) return true; // private 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Expands an IPv6 address into 8 numeric groups, or null when malformed. */
function parseIPv6Groups(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0];
  // Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) → two hex groups
  const v4Match = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) {
    const octets = v4Match[1].split(".").map(Number);
    if (octets.some((n) => Number.isNaN(n) || n > 255)) return null;
    const hex = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    addr = addr.slice(0, -v4Match[1].length) + hex;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((g) =>
    parseInt(g, 16),
  );
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

function embeddedIPv4(hi: number, lo: number): string {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function isBlockedIPv6(ip: string): boolean {
  const g = parseIPv6Groups(ip);
  if (!g) return true;
  const leadingZero = g.slice(0, 5).every((x) => x === 0);
  // :: (unspecified) and ::1 (loopback)
  if (leadingZero && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true;
  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d) — judge the IPv4 part
  if (leadingZero && (g[5] === 0xffff || g[5] === 0)) return isBlockedIPv4(embeddedIPv4(g[6], g[7]));
  // NAT64 well-known prefix 64:ff9b::/96
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(embeddedIPv4(g[6], g[7]));
  }
  // 6to4 2002::/16 embeds an IPv4 address in groups 1–2
  if (g[0] === 0x2002) return isBlockedIPv4(embeddedIPv4(g[1], g[2]));
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export function isBlockedIP(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIPv4(ip);
  if (isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

export type SafeTlsTarget =
  | { ok: true; connectHost: string; servername: string }
  | { ok: false; error: string };

/**
 * Resolve hostname to a connect target after SSRF checks, for TLS (SNI + validated IP).
 * Re-resolves at call time to reduce TOCTOU vs an earlier URL check.
 */
export async function resolveSafeTlsConnectTarget(hostname: string): Promise<SafeTlsTarget> {
  const h = hostname.toLowerCase().trim().replace(/^\[(.*)\]$/, "$1");
  if (!h) {
    return { ok: false, error: "Missing hostname" };
  }
  if (BLOCKED_HOSTNAMES.has(h)) {
    return { ok: false, error: "URL hostname is not allowed" };
  }

  if (isIPv4(h) || isIPv6(h)) {
    if (isBlockedIP(h)) {
      return { ok: false, error: "URL points to a disallowed address" };
    }
    return { ok: true, connectHost: h, servername: h };
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(h, { all: true });
  } catch {
    return { ok: false, error: "Could not resolve hostname" };
  }
  if (!addresses.length) {
    return { ok: false, error: "Could not resolve hostname" };
  }
  for (const { address } of addresses) {
    if (isBlockedIP(address)) {
      return { ok: false, error: "URL resolves to a disallowed address" };
    }
  }
  return { ok: true, connectHost: addresses[0].address, servername: h };
}

export type UrlCheckResult =
  | { allowed: true; resolvedHost: string }
  | { allowed: false; reason: string };

/**
 * Validates a URL for SSRF safety and returns the pre-resolved host IP.
 * Allows only http/https; blocks private/loopback/link-local IPs and reserved hostnames.
 */
export async function checkUrlAllowed(urlString: string): Promise<UrlCheckResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { allowed: false, reason: "Only HTTP and HTTPS URLs are allowed" };
  }

  const target = await resolveSafeTlsConnectTarget(url.hostname);
  if (!target.ok) {
    return { allowed: false, reason: target.error };
  }

  return { allowed: true, resolvedHost: target.connectHost };
}

/**
 * Returns an error message if the URL must not be fetched (SSRF), or null if allowed.
 */
export async function getUrlNotAllowedReason(urlString: string): Promise<string | null> {
  const result = await checkUrlAllowed(urlString);
  return result.allowed ? null : result.reason;
}
