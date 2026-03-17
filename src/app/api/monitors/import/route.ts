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
  validateEmail,
  validateExpectedStatusCodes,
  validateMonitorName,
  validateMonitorUrl,
} from "@/lib/validate-monitor";
import { runCheck } from "@/lib/run-check";
import type { Monitor } from "@/db/schema";

const MAX_IMPORT_COUNT = 100;

type ImportError = { index: number; name: string; url: string; error: string };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(request, MAX_BULK_JSON_BODY_BYTES);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON array of monitors" },
      { status: 400 }
    );
  }

  if (body.length === 0) {
    return NextResponse.json(
      { error: "At least one monitor is required" },
      { status: 400 }
    );
  }

  if (body.length > MAX_IMPORT_COUNT) {
    return NextResponse.json(
      { error: `At most ${MAX_IMPORT_COUNT} monitors can be imported at once` },
      { status: 400 }
    );
  }

  type ValidEntry = {
    name: string;
    url: string;
    method: "GET" | "HEAD";
    intervalMinutes: number;
    timeoutSeconds: number;
    expectedStatusCodes: string;
    alertEmail: boolean;
    alertEmailTo: string | null;
    sslMonitoring: boolean;
    showOnStatusPage: boolean;
  };

  const valid: ValidEntry[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < body.length; i++) {
    const item = body[i] as Record<string, unknown>;
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "";
    const url =
      typeof item.url === "string" && item.url.trim() ? item.url.trim() : "";

    const nameError = name ? validateMonitorName(name) : "Name is required";
    if (nameError) {
      errors.push({ index: i + 1, name, url, error: nameError });
      continue;
    }

    const urlError = url ? validateMonitorUrl(url) : "URL is required";
    if (urlError) {
      errors.push({ index: i + 1, name, url, error: urlError });
      continue;
    }

    const expectedStatusCodes =
      typeof item.expectedStatusCodes === "string" &&
      item.expectedStatusCodes.trim()
        ? item.expectedStatusCodes.trim()
        : "200-299";
    const codesError = validateExpectedStatusCodes(expectedStatusCodes);
    if (codesError) {
      errors.push({ index: i + 1, name, url, error: codesError });
      continue;
    }

    const alertEmailTo =
      typeof item.alertEmailTo === "string" && item.alertEmailTo.trim()
        ? item.alertEmailTo.trim()
        : null;
    if (alertEmailTo) {
      const emailError = validateEmail(alertEmailTo);
      if (emailError) {
        errors.push({
          index: i + 1,
          name,
          url,
          error: `Alert email: ${emailError}`,
        });
        continue;
      }
    }

    const intervalMinutes =
      typeof item.intervalMinutes === "number" && item.intervalMinutes >= 1
        ? Math.min(Math.round(item.intervalMinutes), 60)
        : 5;
    const timeoutSeconds =
      typeof item.timeoutSeconds === "number" && item.timeoutSeconds >= 5
        ? Math.min(Math.round(item.timeoutSeconds), 120)
        : 15;
    const method = item.method === "HEAD" ? "HEAD" : ("GET" as const);
    const alertEmail = item.alertEmail === true;
    const sslMonitoring = item.sslMonitoring === true;
    const showOnStatusPage =
      typeof item.showOnStatusPage === "boolean" ? item.showOnStatusPage : true;

    valid.push({
      name,
      url,
      method,
      intervalMinutes,
      timeoutSeconds,
      expectedStatusCodes,
      alertEmail,
      alertEmailTo,
      sslMonitoring,
      showOnStatusPage,
    });
  }

  if (valid.length === 0) {
    return NextResponse.json(
      { error: "No valid monitors to import", errors },
      { status: 400 }
    );
  }

  const now = new Date();
  const ids: string[] = [];

  db.transaction((tx) => {
    for (const entry of valid) {
      const id = randomUUID();
      ids.push(id);
      tx.insert(monitor)
        .values({
          id,
          userId: session.user!.id,
          name: entry.name,
          url: entry.url,
          intervalMinutes: entry.intervalMinutes,
          timeoutSeconds: entry.timeoutSeconds,
          method: entry.method,
          expectedStatusCodes: entry.expectedStatusCodes,
          alertEmail: entry.alertEmail,
          alertEmailTo: entry.alertEmailTo,
          sslMonitoring: entry.sslMonitoring,
          showOnStatusPage: entry.showOnStatusPage,
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
      console.error("[monitors/import] immediate check failed for", m.id, err);
    });
  }

  return NextResponse.json({ created: created.length, errors });
}
