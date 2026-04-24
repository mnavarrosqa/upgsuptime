import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkBodySizeLimit } from "@/lib/validate-monitor";
import { parseMonitorConfigForUpdate } from "@/lib/monitor-config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id)));
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(m);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bodySizeError = checkBodySizeLimit(request);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  const body = await request.json();

  const parsed = parseMonitorConfigForUpdate(body, existing);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const config = parsed.config;
  // Reset baseline when the endpoint changes so stale data isn't used for the new target.
  const urlChanged =
    config.url !== existing.url ||
    config.method !== existing.method ||
    config.requestBody !== existing.requestBody ||
    config.requestHeaders !== existing.requestHeaders ||
    config.tcpHost !== existing.tcpHost ||
    config.tcpPort !== existing.tcpPort;
  const baselineReset = urlChanged
    ? {
        baselineP75Ms: null,
        baselineSampleCount: 0,
        consecutiveDegradedChecks: 0,
        degradingAlertSentAt: null,
        baselineResetAt: new Date(),
      }
    : {};

  await db
    .update(monitor)
    .set({
      ...config,
      ...baselineReset,
    })
    .where(eq(monitor.id, id));

  const [updated] = await db.select().from(monitor).where(eq(monitor.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(monitor).where(eq(monitor.id, id));
  return NextResponse.json({ success: true });
}
