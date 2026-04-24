import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { checkBodySizeLimit } from "@/lib/validate-monitor";
import { parseMonitorConfigForCreate } from "@/lib/monitor-config";
import { runCheck } from "@/lib/run-check";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(request);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  const body = await request.json();

  const parsed = parseMonitorConfigForCreate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(monitor).values({
    id,
    userId: session.user.id,
    ...parsed.config,
    paused: false,
    createdAt: now,
  });

  const [created] = await db.select().from(monitor).where(eq(monitor.id, id));

  // Kick off an immediate check so the monitor has data right away
  runCheck(created, session.user.email ?? "").catch((err) => {
    console.error("[monitors] immediate check failed for", id, err);
  });

  return NextResponse.json(created);
}
