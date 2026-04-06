import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkBodySizeLimit } from "@/lib/validate-monitor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(request);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  const { id } = await params;
  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id)));
  if (!m) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { acknowledged?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const acknowledged = body.acknowledged;
  if (typeof acknowledged !== "boolean") {
    return NextResponse.json({ error: "acknowledged must be a boolean" }, { status: 400 });
  }

  if (acknowledged) {
    if (m.currentStatus !== false || !m.lastStatusChangedAt) {
      return NextResponse.json(
        { error: "Monitor is not in a confirmed down state" },
        { status: 400 }
      );
    }
    await db
      .update(monitor)
      .set({ downtimeAckEpisodeAt: m.lastStatusChangedAt })
      .where(eq(monitor.id, id));
  } else {
    await db
      .update(monitor)
      .set({ downtimeAckEpisodeAt: null })
      .where(eq(monitor.id, id));
  }

  return NextResponse.json({ ok: true });
}
