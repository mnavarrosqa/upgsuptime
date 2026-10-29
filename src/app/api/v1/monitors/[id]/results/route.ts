import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { checkResult, monitor } from "@/db/schema";
import { apiError, apiJson, getApiUser, toCheckResult } from "@/lib/api-v1";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Check history, newest first. Paginate with `?before=<nextBefore>` from the
 * previous page; `nextBefore` is null on the last page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  const { id } = await params;
  const [m] = await db
    .select({ id: monitor.id })
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.userId, user.id)));
  if (!m) return apiError(404, "NOT_FOUND");

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitParam))) : DEFAULT_LIMIT;
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;
  if (before && Number.isNaN(before.getTime())) return apiError(400, "INVALID_CURSOR");

  const rows = await db
    .select()
    .from(checkResult)
    .where(
      before
        ? and(eq(checkResult.monitorId, id), lt(checkResult.createdAt, before))
        : eq(checkResult.monitorId, id),
    )
    .orderBy(desc(checkResult.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return apiJson({
    results: page.map(toCheckResult),
    nextBefore: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  });
}
