import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user, monitor, checkResult, degradationAlertEvent } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appendActivityDismissedId } from "@/lib/activity-dismissed-ids";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = (body as { id?: unknown }).id;
  const kind = (body as { kind?: unknown }).kind;

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (kind !== "status" && kind !== "degradation") {
    return NextResponse.json(
      { error: "kind must be status or degradation" },
      { status: 400 }
    );
  }

  const uid = session.user.id;

  if (kind === "status") {
    const rows = await db
      .select({ id: checkResult.id })
      .from(checkResult)
      .innerJoin(monitor, eq(checkResult.monitorId, monitor.id))
      .where(and(eq(checkResult.id, id), eq(monitor.userId, uid)))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    const rows = await db
      .select({ id: degradationAlertEvent.id })
      .from(degradationAlertEvent)
      .innerJoin(monitor, eq(degradationAlertEvent.monitorId, monitor.id))
      .where(
        and(eq(degradationAlertEvent.id, id), eq(monitor.userId, uid))
      )
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const [row] = await db
    .select({ activityDismissedIds: user.activityDismissedIds })
    .from(user)
    .where(eq(user.id, uid));

  const next = appendActivityDismissedId(row?.activityDismissedIds ?? null, id);
  await db
    .update(user)
    .set({ activityDismissedIds: next })
    .where(eq(user.id, uid));

  return NextResponse.json({ ok: true });
}
