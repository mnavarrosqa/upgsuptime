import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const role = body.role;

  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent self-demotion
  if (id === session.user.id && role !== "admin") {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.update(user).set({ role }).where(eq(user.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.delete(user).where(eq(user.id, id));

  return NextResponse.json({ success: true });
}
