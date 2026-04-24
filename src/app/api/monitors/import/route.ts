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
} from "@/lib/validate-monitor";
import { parseMonitorConfigForCreate, type ParsedMonitorConfig } from "@/lib/monitor-config";
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

  const valid: ParsedMonitorConfig[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < body.length; i++) {
    const item = body[i] as Record<string, unknown>;
    const parsed = parseMonitorConfigForCreate(item);
    if (!parsed.ok) {
      errors.push({
        index: i + 1,
        name: typeof item.name === "string" ? item.name : "",
        url: typeof item.url === "string" ? item.url : "",
        error: parsed.error,
      });
      continue;
    }
    valid.push(parsed.config);
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
          ...entry,
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
