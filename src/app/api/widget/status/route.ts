import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import {
  API_KEY_SCOPE_STATUS_READ,
  authenticateApiKey,
  buildCorsHeaders,
  enforceApiRateLimit,
  isOriginAllowed,
  touchApiKeyUsage,
} from "@/lib/api-keys";
import {
  buildMonitorPublicStatusItem,
  getUptimeStats90d,
  ninetyDaysAgoFrom,
} from "@/lib/monitor-public-status";

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, API_KEY_SCOPE_STATUS_READ);
  if (!auth.ok) {
    return NextResponse.json({ errorCode: auth.errorCode }, { status: auth.status });
  }

  const rate = enforceApiRateLimit(auth.key.id);
  if (!rate.ok) {
    return NextResponse.json(
      { errorCode: "API_RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const origin = request.headers.get("origin");
  if (origin && auth.corsOrigins.length > 0 && !isOriginAllowed(origin, auth.corsOrigins)) {
    return NextResponse.json({ errorCode: "API_ORIGIN_NOT_ALLOWED" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monitorId = url.searchParams.get("monitorId");
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;

  const filters = [eq(monitor.userId, auth.key.userId)];
  if (monitorId) filters.push(eq(monitor.id, monitorId));
  const allMonitors = await db.select().from(monitor).where(and(...filters)).limit(limit);
  const monitors = allMonitors.filter((m) => m.showOnStatusPage !== false);

  const ninetyDaysAgo = ninetyDaysAgoFrom();
  const stats = await getUptimeStats90d(
    monitors.map((m) => m.id),
    ninetyDaysAgo
  );
  const monitorsPayload = monitors.map((m) =>
    buildMonitorPublicStatusItem(m, stats.get(m.id))
  );

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  await touchApiKeyUsage(auth.key.id, ip ?? null);

  const response = NextResponse.json(
    {
      scope: auth.key.scope,
      generatedAt: new Date().toISOString(),
      monitorCount: monitorsPayload.length,
      monitors: monitorsPayload,
    },
    { status: 200 }
  );
  if (origin && auth.corsOrigins.length > 0 && isOriginAllowed(origin, auth.corsOrigins)) {
    const corsHeaders = buildCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}
