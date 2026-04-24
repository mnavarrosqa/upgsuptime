import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  buildMonitorPublicStatusItem,
  getUptimeStats90d,
  ninetyDaysAgoFrom,
} from "@/lib/monitor-public-status";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function enforcePublicStatusRateLimit(request: Request):
  | { ok: true }
  | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const key = getClientKey(request);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  return { ok: true };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const rateLimit = enforcePublicStatusRateLimit(request);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const { username } = await params;

  const [u] = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(eq(user.username, username));

  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allMonitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, u.id));

  const publicMonitors = allMonitors.filter((m) => m.showOnStatusPage !== false);

  const ninetyDaysAgo = ninetyDaysAgoFrom();
  const stats = await getUptimeStats90d(
    publicMonitors.map((m) => m.id),
    ninetyDaysAgo
  );
  const monitors = publicMonitors.map((m) =>
    buildMonitorPublicStatusItem(m, stats.get(m.id))
  );

  return NextResponse.json(
    { username: u.username, monitors },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
