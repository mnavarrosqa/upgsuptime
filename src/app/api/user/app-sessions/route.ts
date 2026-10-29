import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { mobileSession, pushDevice } from "@/db/schema";
import { revokeAllMobileSessions } from "@/lib/mobile-auth";

/** Devices signed in to the native app, most recently active first. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const sessions = await db
    .select({
      id: mobileSession.id,
      deviceName: mobileSession.deviceName,
      createdAt: mobileSession.createdAt,
      lastUsedAt: mobileSession.lastUsedAt,
    })
    .from(mobileSession)
    .where(
      and(
        eq(mobileSession.userId, session.user.id),
        isNull(mobileSession.revokedAt),
        gt(mobileSession.expiresAt, now),
      ),
    )
    .orderBy(desc(mobileSession.lastUsedAt));

  const devices = await db
    .select({ sessionId: pushDevice.sessionId })
    .from(pushDevice)
    .where(eq(pushDevice.userId, session.user.id));
  const withPush = new Set(devices.map((d) => d.sessionId));

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: (s.lastUsedAt ?? s.createdAt).toISOString(),
      pushEnabled: withPush.has(s.id),
    })),
  );
}

/** Signs every app device out. */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  await revokeAllMobileSessions(session.user.id);
  return NextResponse.json({ success: true });
}
