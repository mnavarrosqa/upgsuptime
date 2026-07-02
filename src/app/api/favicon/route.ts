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

async function tryFetchIcon(
  url: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UptimeFavicon/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
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
  const directOriginAllowed =
    (await getUrlNotAllowedReason(`https://${domain}/favicon.ico`)) === null;

  const sources = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    ...(directOriginAllowed ? [`https://${domain}/favicon.ico`] : []),
  ];

  for (const url of sources) {
    const got = await tryFetchIcon(url);
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
