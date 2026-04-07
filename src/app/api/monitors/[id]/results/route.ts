import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor, checkResult } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: monitorId } = await params;

  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, monitorId), eq(monitor.userId, session.user.id)));
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const range = url.searchParams.get("range");
  const rangeHours: Record<string, number> = {
    "24h": 24,
    "7d": 24 * 7,
    "1m": 24 * 30,
  };
  const hours = range ? rangeHours[range] : undefined;

  if (hours) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const results = await db
      .select()
      .from(checkResult)
      .where(and(eq(checkResult.monitorId, monitorId), gte(checkResult.createdAt, since)))
      .orderBy(desc(checkResult.createdAt))
      .limit(5000);

    return NextResponse.json(results);
  }

  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const results = await db
    .select()
    .from(checkResult)
    .where(eq(checkResult.monitorId, monitorId))
    .orderBy(desc(checkResult.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(results);
}
