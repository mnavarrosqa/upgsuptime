import { NextRequest, NextResponse } from "next/server";
import { getUrlNotAllowedReason } from "@/lib/url-allowed";

/**
 * A favicon "domain" must be a bare hostname (optionally with a port) — no path,
 * userinfo, scheme, whitespace or other characters that could be smuggled into a
 * fetch target. Rejecting these early prevents request smuggling into the direct
 * origin fetch below.
 */
function isPlausibleDomain(domain: string): boolean {
  if (domain.length > 253) return false;
  return /^[a-z0-9.-]+(:\d{1,5})?$/.test(domain);
}

/** 1×1 transparent PNG — returned when no favicon can be fetched (avoids img 404 noise in the console). */
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function acceptsAsImage(contentType: string, sourceUrl: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) return true;
  const icoish =
    sourceUrl.includes("/favicon.ico") || sourceUrl.endsWith(".ico");
  if (!icoish) return false;
  return (
    ct === "" ||
    ct.includes("octet-stream") ||
    ct.includes("x-icon") ||
    ct.includes("ico")
  );
}

const MAX_DIRECT_REDIRECTS = 3;

/**
 * Fetches an icon. For the user-controlled origin (`validateHops`), redirects are
 * followed manually and every hop is SSRF-checked, so a redirect cannot reach an
 * internal address.
 */
async function tryFetchIcon(
  url: string,
  validateHops = false,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const signal = AbortSignal.timeout(10_000);
    let currentUrl = url;
    let res: Response;
    for (let hop = 0; ; hop++) {
      res = await fetch(currentUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; UptimeFavicon/1.0)" },
        signal,
        redirect: validateHops ? "manual" : "follow",
      });
      if (!validateHops || res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("Location");
      await res.body?.cancel();
      if (!location || hop >= MAX_DIRECT_REDIRECTS) return null;
      currentUrl = new URL(location, currentUrl).toString();
      if ((await getUrlNotAllowedReason(currentUrl)) !== null) return null;
    }
    if (!res.ok) return null;
    const contentType = res.headers.get("Content-Type") ?? "";
    if (!acceptsAsImage(contentType, url)) return null;
    const body = await res.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > 500_000) return null;
    const primaryType = contentType.split(";")[0]?.trim() || "image/png";
    return { body, contentType: primaryType };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain || !isPlausibleDomain(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  // The first two sources are fixed, trusted third-party icon services (the
  // user-supplied domain is only a query param). The third fetches the origin
  // directly, so it is guarded against SSRF (private/loopback/link-local IPs,
  // reserved hostnames) before being attempted.
  const directOriginUrl = `https://${domain}/favicon.ico`;
  const directOriginAllowed = (await getUrlNotAllowedReason(directOriginUrl)) === null;

  const sources = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    ...(directOriginAllowed ? [directOriginUrl] : []),
  ];

  for (const url of sources) {
    const got = await tryFetchIcon(url, url === directOriginUrl);
    if (got) {
      return new NextResponse(got.body, {
        headers: {
          "Content-Type": got.contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
  }

  return new NextResponse(PLACEHOLDER_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
