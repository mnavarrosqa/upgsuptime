import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  buildMonitorPublicStatusItem,
  getUptimeStats90d,
  ninetyDaysAgoFrom,
} from "@/lib/monitor-public-status";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
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
