import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { apiError, apiJson, getApiUser } from "@/lib/api-v1";
import { isMaintenanceActive } from "@/lib/monitor-config";
import { runCheck } from "@/lib/run-check";

/** Runs a check right now and returns its result. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  const { id } = await params;
  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, user.id)));
  if (!m) return apiError(404, "NOT_FOUND");

  try {
    const result = await runCheck(
      m,
      { email: user.email, language: user.language },
      { maintenanceActive: isMaintenanceActive(m), manual: true },
    );
    return apiJson({
      ok: result.ok,
      statusCode: result.statusCode ?? null,
      responseTimeMs: result.responseTimeMs,
      timings: {
        dnsMs: result.timings?.dnsMs ?? null,
        connectMs: result.timings?.connectMs ?? null,
        tlsMs: result.timings?.tlsMs ?? null,
        ttfbMs: result.timings?.ttfbMs ?? null,
      },
      attempts: result.attempts ?? null,
      message: result.message ?? null,
    });
  } catch (err) {
    return apiError(500, "CHECK_FAILED", err instanceof Error ? err.message : String(err));
  }
}
