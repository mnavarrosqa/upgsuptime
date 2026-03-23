import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  const [row] = await db
    .select({ passwordHash: user.passwordHash })
    .from(user)
    .where(eq(user.id, session.user.id));

  if (!row) {
    return NextResponse.json({ errorCode: "USER_NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json();
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  const valid = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { errorCode: "CURRENT_PASSWORD_INCORRECT" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { errorCode: "PASSWORD_TOO_SHORT" },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { errorCode: "PASSWORDS_DO_NOT_MATCH" },
      { status: 400 }
    );
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { errorCode: "NEW_PASSWORD_SAME_AS_CURRENT" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(user)
    .set({ passwordHash })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ success: true });
}
