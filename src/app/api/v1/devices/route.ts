import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushDevice } from "@/db/schema";
import { apiError, apiJson, getApiUser } from "@/lib/api-v1";

const MAX_TOKEN_LENGTH = 4096;

async function readToken(request: Request): Promise<string | NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "INVALID_JSON");
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > MAX_TOKEN_LENGTH) return apiError(400, "INVALID_TOKEN");
  if (body.platform !== undefined && body.platform !== "android") {
    return apiError(400, "UNSUPPORTED_PLATFORM", 'Only "android" is supported');
  }
  return token;
}

/**
 * Registers this device's FCM token for alerts: `{ token, platform: "android" }`.
 * Needs an app access token, so signing out removes the registration. Call it
 * again whenever FCM rotates the token; re-registering a token moves it to the
 * current session.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  if (!user.sessionId) return apiError(403, "APP_TOKEN_REQUIRED", "Register devices with an app access token");

  const token = await readToken(request);
  if (typeof token !== "string") return token;

  const now = new Date();
  const [existing] = await db.select().from(pushDevice).where(eq(pushDevice.token, token));
  if (existing) {
    await db
      .update(pushDevice)
      .set({ userId: user.id, sessionId: user.sessionId, lastSeenAt: now })
      .where(eq(pushDevice.id, existing.id));
    return apiJson({ id: existing.id, registered: true });
  }

  const id = randomUUID();
  await db.insert(pushDevice).values({
    id,
    userId: user.id,
    sessionId: user.sessionId,
    platform: "android",
    token,
    createdAt: now,
    lastSeenAt: now,
  });
  return apiJson({ id, registered: true }, { status: 201 });
}

/** Stops alerts to a device: `{ token }`. */
export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  const token = await readToken(request);
  if (typeof token !== "string") return token;

  await db.delete(pushDevice).where(and(eq(pushDevice.token, token), eq(pushDevice.userId, user.id)));
  return new NextResponse(null, { status: 204 });
}
