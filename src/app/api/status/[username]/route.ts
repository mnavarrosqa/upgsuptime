import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor, user, checkResult } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

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

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const monitors = await Promise.all(
    publicMonitors.map(async (m) => {
      const rows = await db
        .select({ ok: checkResult.ok })
        .from(checkResult)
        .where(
          and(
            eq(checkResult.monitorId, m.id),
            gte(checkResult.createdAt, ninetyDaysAgo)
          )
        );

      const total = rows.length;
      const okCount = rows.filter((r) => r.ok).length;
      const uptimePct = total > 0 ? Math.round((okCount / total) * 1000) / 10 : null;

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        currentStatus: m.currentStatus,
        lastCheckAt: m.lastCheckAt ? new Date(m.lastCheckAt).toISOString() : null,
        lastStatusChangedAt: m.lastStatusChangedAt
          ? new Date(m.lastStatusChangedAt).toISOString()
          : null,
        uptimePct,
        checkCount90d: total,
      };
    })
  );

  return NextResponse.json({ username: u.username, monitors });
}
