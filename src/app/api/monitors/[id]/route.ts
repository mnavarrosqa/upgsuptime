import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  checkBodySizeLimit,
  validateEmail,
  validateExpectedStatusCodes,
  validateMonitorName,
  validateMonitorUrl,
} from "@/lib/validate-monitor";

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
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const url = typeof body.url === "string" ? body.url.trim() : existing.url;
  const intervalMinutes =
    typeof body.intervalMinutes === "number" && body.intervalMinutes >= 1
      ? Math.min(body.intervalMinutes, 60)
      : existing.intervalMinutes;
  const timeoutSeconds =
    typeof body.timeoutSeconds === "number" && body.timeoutSeconds >= 5
      ? Math.min(body.timeoutSeconds, 120)
      : existing.timeoutSeconds;
  const method =
    body.method === "HEAD" ? "HEAD" : body.method === "GET" ? "GET" : existing.method;
  const expectedStatusCodes =
    typeof body.expectedStatusCodes === "string" && body.expectedStatusCodes.trim()
      ? body.expectedStatusCodes.trim()
      : existing.expectedStatusCodes;
  const alertEmail =
    typeof body.alertEmail === "boolean" ? body.alertEmail : !!existing.alertEmail;
  const alertEmailTo =
    typeof body.alertEmailTo === "string" && body.alertEmailTo.trim()
      ? body.alertEmailTo.trim()
      : body.alertEmailTo === null
        ? null
        : existing.alertEmailTo;
  const sslMonitoring =
    typeof body.sslMonitoring === "boolean" ? body.sslMonitoring : !!existing.sslMonitoring;
  const showOnStatusPage =
    typeof body.showOnStatusPage === "boolean"
      ? body.showOnStatusPage
      : existing.showOnStatusPage !== false;

  if (!name || !url) {
    return NextResponse.json(
      { error: "Name and URL are required" },
      { status: 400 }
    );
  }
  const nameError = validateMonitorName(name);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }
  const urlError = validateMonitorUrl(url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }
  const codesError = validateExpectedStatusCodes(expectedStatusCodes);
  if (codesError) {
    return NextResponse.json({ error: codesError }, { status: 400 });
  }
  if (alertEmailTo) {
    const emailError = validateEmail(alertEmailTo);
    if (emailError) {
      return NextResponse.json({ error: `Alert email: ${emailError}` }, { status: 400 });
    }
  }

  await db
    .update(monitor)
    .set({ name, url, intervalMinutes, timeoutSeconds, method, expectedStatusCodes, alertEmail, alertEmailTo, sslMonitoring, showOnStatusPage })
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
