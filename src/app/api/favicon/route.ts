import { NextRequest, NextResponse } from "next/server";

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
  if (!domain) return new NextResponse(null, { status: 400 });

  const sources = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    `https://${domain}/favicon.ico`,
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
