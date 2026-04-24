import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redactRequestHeaders } from "@/lib/monitor-config";

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
    type: m.type,
    intervalMinutes: m.intervalMinutes,
    timeoutSeconds: m.timeoutSeconds,
    expectedStatusCodes: m.expectedStatusCodes,
    requestHeaders: redactRequestHeaders(m.requestHeaders),
    requestBody: null,
    requestBodyType: m.requestBodyType ?? "none",
    followRedirects: m.followRedirects !== false,
    maxRedirects: m.maxRedirects ?? 20,
    alertEmail: m.alertEmail ?? false,
    alertEmailTo: m.alertEmailTo ?? null,
    sslMonitoring: m.sslMonitoring ?? false,
    showOnStatusPage: m.showOnStatusPage ?? true,
    tcpHost: m.tcpHost ?? null,
    tcpPort: m.tcpPort ?? null,
    maintenanceStartsAt: m.maintenanceStartsAt?.toISOString() ?? null,
    maintenanceEndsAt: m.maintenanceEndsAt?.toISOString() ?? null,
    maintenanceNote: m.maintenanceNote ?? null,
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
