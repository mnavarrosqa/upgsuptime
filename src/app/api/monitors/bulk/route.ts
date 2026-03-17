import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  checkBodySizeLimit,
  MAX_BULK_JSON_BODY_BYTES,
  MAX_NAME_LENGTH,
  validateEmail,
  validateExpectedStatusCodes,
  validateMonitorName,
  validateMonitorUrl,
} from "@/lib/validate-monitor";
import { runCheck } from "@/lib/run-check";
import type { Monitor } from "@/db/schema";

const MAX_BULK_URLS = 100;

function deriveName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.length > MAX_NAME_LENGTH) {
      return hostname.slice(0, MAX_NAME_LENGTH);
    }
    return hostname;
  } catch {
    return url.trim().length > MAX_NAME_LENGTH
      ? url.trim().slice(0, MAX_NAME_LENGTH)
      : url.trim() || "Monitor";
  }
}

type BulkDetail = { index: number; url: string; error: string };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(request, MAX_BULK_JSON_BODY_BYTES);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  const body = await request.json();
  const rawUrls = Array.isArray(body.urls) ? body.urls : [];
  const urls = rawUrls
    .map((u: unknown) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "At least one URL is required" },
      { status: 400 }
    );
  }
  if (urls.length > MAX_BULK_URLS) {
    return NextResponse.json(
      { error: `At most ${MAX_BULK_URLS} URLs are allowed per request` },
      { status: 400 }
    );
  }

  const intervalMinutes =
    typeof body.intervalMinutes === "number" && body.intervalMinutes >= 1
      ? Math.min(body.intervalMinutes, 60)
      : 5;
  const timeoutSeconds =
    typeof body.timeoutSeconds === "number" && body.timeoutSeconds >= 5
      ? Math.min(body.timeoutSeconds, 120)
      : 15;
  const method = body.method === "HEAD" ? "HEAD" : "GET";
  const expectedStatusCodes =
    typeof body.expectedStatusCodes === "string" &&
    body.expectedStatusCodes.trim()
      ? body.expectedStatusCodes.trim()
      : "200-299";
  const alertEmail = body.alertEmail === true;
  const alertEmailTo =
    typeof body.alertEmailTo === "string" && body.alertEmailTo.trim()
      ? body.alertEmailTo.trim()
      : null;
  const sslMonitoring = body.sslMonitoring === true;
  const showOnStatusPage =
    typeof body.showOnStatusPage === "boolean" ? body.showOnStatusPage : true;

  const codesError = validateExpectedStatusCodes(expectedStatusCodes);
  if (codesError) {
    return NextResponse.json({ error: codesError }, { status: 400 });
  }
  if (alertEmailTo) {
    const emailError = validateEmail(alertEmailTo);
    if (emailError) {
      return NextResponse.json(
        { error: `Alert email: ${emailError}` },
        { status: 400 }
      );
    }
  }

  const details: BulkDetail[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const urlError = validateMonitorUrl(url);
    if (urlError) {
      details.push({ index: i + 1, url, error: urlError });
      continue;
    }
    const name = deriveName(url);
    const nameError = validateMonitorName(name);
    if (nameError) {
      details.push({ index: i + 1, url, error: nameError });
    }
  }
  if (details.length > 0) {
    return NextResponse.json(
      {
        error: "Some URLs are invalid",
        details,
      },
      { status: 400 }
    );
  }

  const now = new Date();
  const ids: string[] = [];

  db.transaction((tx) => {
    for (const url of urls) {
      const id = randomUUID();
      ids.push(id);
      const name = deriveName(url);
      tx.insert(monitor)
        .values({
          id,
          userId: session.user!.id,
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
          createdAt: now,
        })
        .run();
    }
  });

  const created = await db
    .select()
    .from(monitor)
    .where(inArray(monitor.id, ids));

  const ownerEmail = session.user?.email ?? "";
  for (const m of created) {
    runCheck(m as Monitor, ownerEmail).catch((err) => {
      console.error("[monitors/bulk] immediate check failed for", m.id, err);
    });
  }

  return NextResponse.json({ created: created.length, monitors: created });
}
