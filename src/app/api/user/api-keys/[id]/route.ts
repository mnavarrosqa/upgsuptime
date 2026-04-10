import { and, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { isApiKeyNameTaken, parseCorsOriginsInput } from "@/lib/api-keys";

function parseExpiresAt(expiresAt: unknown): Date | null | "invalid" {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") return null;
  if (typeof expiresAt !== "string") return "invalid";
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return "invalid";
  return parsed;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    expiresAt?: unknown;
    corsOrigins?: unknown;
  };
  const updates: {
    name?: string;
    expiresAt?: Date | null;
    corsOrigins?: string;
  } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ errorCode: "API_KEY_NAME_REQUIRED" }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ errorCode: "API_KEY_NAME_TOO_LONG" }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.expiresAt !== undefined) {
    const expiresAt = parseExpiresAt(body.expiresAt);
    if (expiresAt === "invalid") {
      return NextResponse.json({ errorCode: "API_KEY_EXPIRES_INVALID" }, { status: 400 });
    }
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ errorCode: "API_KEY_EXPIRES_PAST" }, { status: 400 });
    }
    updates.expiresAt = expiresAt;
  }

  if (body.corsOrigins !== undefined) {
    updates.corsOrigins = JSON.stringify(parseCorsOriginsInput(body.corsOrigins));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ errorCode: "API_KEY_NO_CHANGES" }, { status: 400 });
  }

  if (updates.name !== undefined && (await isApiKeyNameTaken(session.user.id, updates.name, id))) {
    return NextResponse.json({ errorCode: "API_KEY_NAME_TAKEN" }, { status: 400 });
  }

  const result = await db
    .update(apiKey)
    .set(updates)
    .where(and(eq(apiKey.id, id), eq(apiKey.userId, session.user.id), isNull(apiKey.revokedAt)));

  if (result.changes === 0) {
    return NextResponse.json({ errorCode: "API_KEY_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
