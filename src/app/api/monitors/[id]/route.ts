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
  validateMonitorHostname,
  validateDnsRecordType,
  validateKeywordContains,
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

  // Type is immutable — always read from the existing monitor
  const type = existing.type ?? "http";

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
  // Keyword monitors always use GET; DNS doesn't use method
  const method =
    type === "keyword"
      ? "GET"
      : body.method === "HEAD" ? "HEAD" : body.method === "GET" ? "GET" : existing.method;
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
  // DNS monitors never use SSL monitoring
  const sslMonitoring =
    type === "dns"
      ? false
      : typeof body.sslMonitoring === "boolean"
        ? body.sslMonitoring
        : !!existing.sslMonitoring;
  const showOnStatusPage =
    typeof body.showOnStatusPage === "boolean"
      ? body.showOnStatusPage
      : existing.showOnStatusPage !== false;
  const paused =
    typeof body.paused === "boolean" ? body.paused : !!existing.paused;

  // Keyword-specific fields
  const keywordContains =
    type === "keyword"
      ? typeof body.keywordContains === "string"
        ? body.keywordContains.trim() || null
        : existing.keywordContains
      : null;
  const keywordShouldExist =
    type === "keyword"
      ? typeof body.keywordShouldExist === "boolean"
        ? body.keywordShouldExist
        : existing.keywordShouldExist !== false
      : null;

  // DNS-specific fields
  const dnsRecordType =
    type === "dns"
      ? typeof body.dnsRecordType === "string"
        ? body.dnsRecordType.trim()
        : existing.dnsRecordType
      : null;
  const dnsExpectedValue =
    type === "dns"
      ? typeof body.dnsExpectedValue === "string"
        ? body.dnsExpectedValue.trim() || null
        : existing.dnsExpectedValue
      : null;

  // --- Validation ---
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const nameError = validateMonitorName(name);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  if (type === "dns") {
    if (!url) {
      return NextResponse.json({ error: "Hostname is required" }, { status: 400 });
    }
    const hostnameError = validateMonitorHostname(url);
    if (hostnameError) {
      return NextResponse.json({ error: hostnameError }, { status: 400 });
    }
    if (!dnsRecordType) {
      return NextResponse.json({ error: "DNS record type is required" }, { status: 400 });
    }
    const recordTypeError = validateDnsRecordType(dnsRecordType);
    if (recordTypeError) {
      return NextResponse.json({ error: recordTypeError }, { status: 400 });
    }
    if (!dnsExpectedValue) {
      return NextResponse.json({ error: "Expected value is required for DNS monitors" }, { status: 400 });
    }
  } else {
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    const urlError = validateMonitorUrl(url);
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }
    const codesError = validateExpectedStatusCodes(expectedStatusCodes);
    if (codesError) {
      return NextResponse.json({ error: codesError }, { status: 400 });
    }
  }

  if (type === "keyword") {
    const kwError = validateKeywordContains(keywordContains ?? "");
    if (kwError) {
      return NextResponse.json({ error: kwError }, { status: 400 });
    }
  }

  if (alertEmailTo) {
    const emailError = validateEmail(alertEmailTo);
    if (emailError) {
      return NextResponse.json({ error: `Alert email: ${emailError}` }, { status: 400 });
    }
  }

  await db
    .update(monitor)
    .set({
      name, url, intervalMinutes, timeoutSeconds, method, expectedStatusCodes,
      alertEmail, alertEmailTo, sslMonitoring, showOnStatusPage, paused,
      keywordContains, keywordShouldExist, dnsRecordType, dnsExpectedValue,
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
