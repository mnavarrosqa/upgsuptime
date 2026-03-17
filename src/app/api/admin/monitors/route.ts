import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monitors = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      intervalMinutes: monitor.intervalMinutes,
      currentStatus: monitor.currentStatus,
      lastCheckAt: monitor.lastCheckAt,
      createdAt: monitor.createdAt,
      ownerEmail: user.email,
      ownerUsername: user.username,
    })
    .from(monitor)
    .innerJoin(user, eq(monitor.userId, user.id))
    .orderBy(user.email, monitor.name);

  return NextResponse.json(monitors);
}
