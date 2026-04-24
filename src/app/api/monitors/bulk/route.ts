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
import { deriveMonitorNameFromUrl } from "@/lib/derive-monitor-name";
import { runCheck } from "@/lib/run-check";
import type { Monitor } from "@/db/schema";

const MAX_BULK_URLS = 100;

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
  const rawItems = Array.isArray(body.items) ? body.items : null;

  type Entry = { url: string; name: string };
  let entries: Entry[] = [];

  if (rawItems && rawItems.length > 0) {
    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!url) continue;
      const nameRaw = typeof o.name === "string" ? o.name.trim() : "";
      const name = nameRaw || deriveMonitorNameFromUrl(url);
      entries.push({ url, name });
    }
  } else {
    const urls: string[] = rawUrls
      .map((u: unknown) => (typeof u === "string" ? u.trim() : ""))
      .filter((s: string) => s.length > 0);
    entries = urls.map((url: string) => ({
      url,
      name: deriveMonitorNameFromUrl(url),
    }));
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "At least one URL is required" },
      { status: 400 }
    );
  }
  if (entries.length > MAX_BULK_URLS) {
    return NextResponse.json(
      { error: `At most ${MAX_BULK_URLS} sites are allowed per request` },
      { status: 400 }
    );
  }

  const details: BulkDetail[] = [];
  const valid: ParsedMonitorConfig[] = [];
  for (let i = 0; i < entries.length; i++) {
    const { url, name } = entries[i];
    const parsed = parseMonitorConfigForCreate({
      ...body,
      type: "http",
      name,
      url,
    });
    if (!parsed.ok) {
      details.push({ index: i + 1, url, error: parsed.error });
      continue;
    }
    valid.push(parsed.config);
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
    for (const config of valid) {
      const id = randomUUID();
      ids.push(id);
      tx.insert(monitor)
        .values({
          id,
          userId: session.user!.id,
          ...config,
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
