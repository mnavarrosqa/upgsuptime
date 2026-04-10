import { and, eq, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { createApiKeyToken } from "@/lib/api-keys";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;

  const [existing] = await db
    .select({
      id: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
      scope: apiKey.scope,
      corsOrigins: apiKey.corsOrigins,
      expiresAt: apiKey.expiresAt,
    })
    .from(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.userId, session.user.id), isNull(apiKey.revokedAt)));

  if (!existing) {
    return NextResponse.json({ errorCode: "API_KEY_NOT_FOUND" }, { status: 404 });
  }

  await db.update(apiKey).set({ revokedAt: new Date() }).where(eq(apiKey.id, existing.id));

  const generated = createApiKeyToken();
  await db.insert(apiKey).values({
    id: generated.id,
    userId: existing.userId,
    name: existing.name,
    keyPrefix: generated.keyPrefix,
    keyHash: generated.keyHash,
    scope: existing.scope,
    corsOrigins: existing.corsOrigins,
    expiresAt: existing.expiresAt,
    createdAt: new Date(),
  });

  return NextResponse.json({
    id: generated.id,
    keyPrefix: generated.keyPrefix,
    token: generated.token,
  });
}
