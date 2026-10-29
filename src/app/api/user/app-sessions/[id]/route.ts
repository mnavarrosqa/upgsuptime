import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { mobileSession } from "@/db/schema";
import { revokeMobileSession } from "@/lib/mobile-auth";

/** Signs one app device out. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const [owned] = await db
    .select({ id: mobileSession.id })
    .from(mobileSession)
    .where(
      and(
        eq(mobileSession.id, id),
        eq(mobileSession.userId, session.user.id),
        isNull(mobileSession.revokedAt),
      ),
    );
  if (!owned) {
    return NextResponse.json({ errorCode: "NOT_FOUND" }, { status: 404 });
  }
  await revokeMobileSession(id);
  return NextResponse.json({ success: true });
}
