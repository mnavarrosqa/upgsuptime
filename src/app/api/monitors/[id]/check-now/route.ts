import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { runCheck } from "@/lib/run-check";
import { isMaintenanceActive } from "@/lib/monitor-config";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, session.user.id)));
  if (!m) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await runCheck(m, session.user.email ?? "", {
      maintenanceActive: isMaintenanceActive(m),
      manual: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Check failed", message },
      { status: 500 }
    );
  }
}
