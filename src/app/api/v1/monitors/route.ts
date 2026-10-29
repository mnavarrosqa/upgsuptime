import { eq } from "drizzle-orm";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { apiError, apiJson, getApiUser, loadMonitorStats, toMonitorListItem } from "@/lib/api-v1";

/** All monitors of the signed-in user with their latest check and 90-day uptime. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");

  const monitors = await db.select().from(monitor).where(eq(monitor.userId, user.id));
  const { latest, uptime } = await loadMonitorStats(monitors.map((m) => m.id));
  return apiJson({
    monitors: monitors
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => toMonitorListItem(m, latest.get(m.id), uptime.get(m.id))),
  });
}
