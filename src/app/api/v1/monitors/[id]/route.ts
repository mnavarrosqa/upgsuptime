import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import {
  apiError,
  apiJson,
  getApiUser,
  loadMonitorStats,
  toMonitorDetail,
  toMonitorListItem,
} from "@/lib/api-v1";

type Params = { params: Promise<{ id: string }> };

async function findOwnedMonitor(id: string, userId: string) {
  const [m] = await db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, userId)));
  return m;
}

async function detailResponse(m: NonNullable<Awaited<ReturnType<typeof findOwnedMonitor>>>) {
  const { latest, uptime } = await loadMonitorStats([m.id]);
  return apiJson({ ...toMonitorDetail(m), ...toMonitorListItem(m, latest.get(m.id), uptime.get(m.id)) });
}

export async function GET(request: Request, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  const m = await findOwnedMonitor((await params).id, user.id);
  if (!m) return apiError(404, "NOT_FOUND");
  return detailResponse(m);
}

/** Pause or resume a monitor: `{ paused: boolean }`. Other settings are edited on the web for now. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  const m = await findOwnedMonitor((await params).id, user.id);
  if (!m) return apiError(404, "NOT_FOUND");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "INVALID_JSON");
  }
  const unsupported = Object.keys(body).filter((key) => key !== "paused");
  if (unsupported.length > 0) {
    return apiError(400, "UNSUPPORTED_FIELD", `Only "paused" can be changed: ${unsupported.join(", ")}`);
  }
  if (typeof body.paused !== "boolean") return apiError(400, "INVALID_FIELD", '"paused" must be a boolean');

  await db.update(monitor).set({ paused: body.paused }).where(eq(monitor.id, m.id));
  return detailResponse({ ...m, paused: body.paused });
}
