import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
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

  // Determine monitor type
  const type = ["keyword", "dns"].includes(body.type) ? (body.type as "keyword" | "dns") : "http";

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const intervalMinutes =
    typeof body.intervalMinutes === "number" && body.intervalMinutes >= 1
      ? Math.min(body.intervalMinutes, 60)
      : 5;
  const timeoutSeconds =
    typeof body.timeoutSeconds === "number" && body.timeoutSeconds >= 5
      ? Math.min(body.timeoutSeconds, 120)
      : 15;
  // Keyword monitors always use GET
  const method = type === "keyword" ? "GET" : (body.method === "HEAD" ? "HEAD" : "GET");
  const expectedStatusCodes =
    typeof body.expectedStatusCodes === "string" && body.expectedStatusCodes.trim()
      ? body.expectedStatusCodes.trim()
      : "200-299";
  const alertEmail = body.alertEmail === true;
  const alertEmailTo =
    typeof body.alertEmailTo === "string" && body.alertEmailTo.trim()
      ? body.alertEmailTo.trim()
      : null;
  // DNS monitors never use SSL monitoring
  const sslMonitoring = type === "dns" ? false : body.sslMonitoring === true;
  const showOnStatusPage =
    typeof body.showOnStatusPage === "boolean" ? body.showOnStatusPage : true;

  // Keyword-specific fields
  const keywordContains =
    type === "keyword" && typeof body.keywordContains === "string"
      ? body.keywordContains.trim() || null
      : null;
  const keywordShouldExist =
    type === "keyword"
      ? typeof body.keywordShouldExist === "boolean"
        ? body.keywordShouldExist
        : true
      : null;

  // DNS-specific fields
  const dnsRecordType =
    type === "dns" && typeof body.dnsRecordType === "string"
      ? body.dnsRecordType.trim()
      : null;
  const dnsExpectedValue =
    type === "dns" && typeof body.dnsExpectedValue === "string"
      ? body.dnsExpectedValue.trim() || null
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

  const id = randomUUID();
  const now = new Date();
  await db.insert(monitor).values({
    id,
    userId: session.user.id,
    name,
    url,
    intervalMinutes,
    timeoutSeconds,
    method,
    expectedStatusCodes,
    alertEmail,
    alertEmailTo,
    sslMonitoring,
    showOnStatusPage,
    type,
    keywordContains,
    keywordShouldExist,
    dnsRecordType,
    dnsExpectedValue,
    createdAt: now,
  });

  const [created] = await db.select().from(monitor).where(eq(monitor.id, id));

  // Kick off an immediate check so the monitor has data right away
  runCheck(created, session.user.email ?? "").catch((err) => {
    console.error("[monitors] immediate check failed for", id, err);
  });

  return NextResponse.json(created);
}
