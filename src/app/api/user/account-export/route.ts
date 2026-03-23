import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { checkResult, monitor, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  ACCOUNT_DATA_VERSION,
  type AccountExportPayload,
  toIsoTimestamp,
} from "@/lib/account-data";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeCheckResults =
    url.searchParams.get("includeCheckResults") !== "false";

  const [u] = await db.select().from(user).where(eq(user.id, session.user.id));
  if (!u) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const monitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const monitorIds = monitors.map((m) => m.id);

  let resultsRows: (typeof checkResult.$inferSelect)[] = [];
  if (includeCheckResults && monitorIds.length > 0) {
    resultsRows = await db
      .select()
      .from(checkResult)
      .where(inArray(checkResult.monitorId, monitorIds));
  }

  const payload: AccountExportPayload = {
    upgAccountExportVersion: ACCOUNT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      email: u.email,
      username: u.username ?? null,
      onboardingCompleted: u.onboardingCompleted ?? null,
      onboardingStep: u.onboardingStep ?? null,
      activityClearedAt: toIsoTimestamp(u.activityClearedAt ?? undefined),
    },
    monitors: monitors.map((m) => ({
      id: m.id,
      name: m.name,
      url: m.url,
      intervalMinutes: m.intervalMinutes,
      timeoutSeconds: m.timeoutSeconds,
      method: m.method,
      expectedStatusCodes: m.expectedStatusCodes,
      lastCheckAt: toIsoTimestamp(m.lastCheckAt ?? undefined),
      currentStatus: m.currentStatus ?? null,
      lastStatusChangedAt: toIsoTimestamp(m.lastStatusChangedAt ?? undefined),
      alertEmail: m.alertEmail ?? false,
      alertEmailTo: m.alertEmailTo ?? null,
      sslMonitoring: m.sslMonitoring ?? false,
      sslValid: m.sslValid ?? null,
      sslExpiresAt: toIsoTimestamp(m.sslExpiresAt ?? undefined),
      sslLastCheckedAt: toIsoTimestamp(m.sslLastCheckedAt ?? undefined),
      showOnStatusPage: m.showOnStatusPage ?? true,
      paused: m.paused ?? false,
      createdAt: toIsoTimestamp(m.createdAt) ?? new Date().toISOString(),
    })),
    checkResults: resultsRows.map((r) => ({
      id: r.id,
      monitorId: r.monitorId,
      statusCode: r.statusCode ?? null,
      responseTimeMs: r.responseTimeMs ?? null,
      ok: r.ok,
      message: r.message ?? null,
      createdAt: toIsoTimestamp(r.createdAt) ?? new Date().toISOString(),
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `upg-account-${date}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
