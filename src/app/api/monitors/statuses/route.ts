import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { isDowntimeAcked } from "@/lib/downtime-ack";

/**
 * Compact current status of every monitor, polled by the open app to spot
 * outages and recoveries (in-app toasts and browser notifications).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      currentStatus: monitor.currentStatus,
      paused: monitor.paused,
      lastStatusChangedAt: monitor.lastStatusChangedAt,
      downtimeAckEpisodeAt: monitor.downtimeAckEpisodeAt,
    })
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  return NextResponse.json(
    {
      monitors: rows.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.paused ? "paused" : m.currentStatus === true ? "up" : m.currentStatus === false ? "down" : "pending",
        changedAt: m.lastStatusChangedAt?.toISOString() ?? null,
        acknowledged: isDowntimeAcked(m),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
