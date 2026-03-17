import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user, monitor } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      monitorCount: count(monitor.id),
    })
    .from(user)
    .leftJoin(monitor, eq(monitor.userId, user.id))
    .groupBy(user.id)
    .orderBy(user.createdAt);

  return NextResponse.json(users);
}
