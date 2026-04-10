import { and, desc, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import {
  API_KEY_SCOPE_STATUS_READ,
  createApiKeyToken,
  isApiKeyNameTaken,
  parseCorsOriginsInput,
} from "@/lib/api-keys";

function parseExpiresAt(expiresAt: unknown): Date | null {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") return null;
  if (typeof expiresAt !== "string") return null;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scope: apiKey.scope,
      corsOrigins: apiKey.corsOrigins,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
    })
    .from(apiKey)
    .where(and(eq(apiKey.userId, session.user.id), isNull(apiKey.revokedAt)))
    .orderBy(desc(apiKey.createdAt));

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      corsOrigins: JSON.parse(row.corsOrigins) as string[],
    }))
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    expiresAt?: unknown;
    corsOrigins?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ errorCode: "API_KEY_NAME_REQUIRED" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ errorCode: "API_KEY_NAME_TOO_LONG" }, { status: 400 });
  }

  if (await isApiKeyNameTaken(session.user.id, name)) {
    return NextResponse.json({ errorCode: "API_KEY_NAME_TAKEN" }, { status: 400 });
  }

  const expiresAt = parseExpiresAt(body.expiresAt);
  if (body.expiresAt && !expiresAt) {
    return NextResponse.json({ errorCode: "API_KEY_EXPIRES_INVALID" }, { status: 400 });
  }
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ errorCode: "API_KEY_EXPIRES_PAST" }, { status: 400 });
  }

  const corsOrigins = parseCorsOriginsInput(body.corsOrigins);
  const generated = createApiKeyToken();

  await db.insert(apiKey).values({
    id: generated.id,
    userId: session.user.id,
    name,
    keyPrefix: generated.keyPrefix,
    keyHash: generated.keyHash,
    scope: API_KEY_SCOPE_STATUS_READ,
    corsOrigins: JSON.stringify(corsOrigins),
    expiresAt,
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: generated.id,
    name,
    keyPrefix: generated.keyPrefix,
    scope: API_KEY_SCOPE_STATUS_READ,
    corsOrigins,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    token: generated.token,
  });
}
