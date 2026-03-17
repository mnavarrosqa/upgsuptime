import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const exportData = monitors.map((m) => ({
    name: m.name,
    url: m.url,
    method: m.method,
    intervalMinutes: m.intervalMinutes,
    timeoutSeconds: m.timeoutSeconds,
    expectedStatusCodes: m.expectedStatusCodes,
    alertEmail: m.alertEmail ?? false,
    alertEmailTo: m.alertEmailTo ?? null,
    sslMonitoring: m.sslMonitoring ?? false,
    showOnStatusPage: m.showOnStatusPage ?? true,
  }));

  const date = new Date().toISOString().slice(0, 10);
  const filename = `monitors-${date}.json`;

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
