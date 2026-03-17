import { NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  const [row] = await db.select({ count: count() }).from(user);
  return NextResponse.json({ needsSetup: row.count === 0 });
}
