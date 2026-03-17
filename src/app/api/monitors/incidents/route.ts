import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const sinceMs = sinceParam ? parseInt(sinceParam, 10) : Date.now() - 60_000;
  const sinceDate = new Date(sinceMs);

  const incidents = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      lastStatusChangedAt: monitor.lastStatusChangedAt,
    })
    .from(monitor)
    .where(
      and(
        eq(monitor.userId, session.user.id),
        eq(monitor.currentStatus, false),
        gte(monitor.lastStatusChangedAt, sinceDate)
      )
    );

  return NextResponse.json({ incidents });
}
