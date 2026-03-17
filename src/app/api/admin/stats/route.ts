import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user, monitor, checkResult } from "@/db/schema";
import { count, eq, gte } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ totalUsers }] = await db
    .select({ totalUsers: count() })
    .from(user);

  const [{ totalMonitors }] = await db
    .select({ totalMonitors: count() })
    .from(monitor);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ checksLast24h }] = await db
    .select({ checksLast24h: count() })
    .from(checkResult)
    .where(gte(checkResult.createdAt, since));

  const [{ monitorsUp }] = await db
    .select({ monitorsUp: count() })
    .from(monitor)
    .where(eq(monitor.currentStatus, true));

  const [{ monitorsDown }] = await db
    .select({ monitorsDown: count() })
    .from(monitor)
    .where(eq(monitor.currentStatus, false));

  return NextResponse.json({
    totalUsers,
    totalMonitors,
    checksLast24h,
    monitorsUp,
    monitorsDown,
  });
}
