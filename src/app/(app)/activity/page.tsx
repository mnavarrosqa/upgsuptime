import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { monitor, user, checkResult } from "@/db/schema";
import { eq, and, gte, gt, lt, inArray, max, asc } from "drizzle-orm";
import { ActivityPageClient } from "@/components/activity-page-client";
import { daysAgoUtc } from "@/lib/server-relative-time";

const MAX_EVENTS = 50;
const PAGE_SIZE = 20;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const since = daysAgoUtc(7);

  const [currentUser] = await db
    .select({ activityClearedAt: user.activityClearedAt })
    .from(user)
    .where(eq(user.id, session.user.id));

  const clearedAt = currentUser?.activityClearedAt ?? null;

  const monitors = await db
    .select({ id: monitor.id, name: monitor.name, url: monitor.url })
    .from(monitor)
    .where(eq(monitor.userId, session.user.id));

  const monitorIds = monitors.map((m) => m.id);
  const monitorById = new Map(monitors.map((m) => [m.id, m]));

  if (monitorIds.length === 0) {
    return (
      <ActivityPageClient
        items={[]}
        page={1}
        totalPages={1}
        totalCount={0}
        pageSize={PAGE_SIZE}
      />
    );
  }

  const latestBeforeWindow = db
    .select({
      monitorId: checkResult.monitorId,
      maxAt: max(checkResult.createdAt).as("maxAt"),
    })
    .from(checkResult)
    .where(and(inArray(checkResult.monitorId, monitorIds), lt(checkResult.createdAt, since)))
    .groupBy(checkResult.monitorId)
    .as("latest_before");

  const baselineRows = await db
    .select({
      monitorId: checkResult.monitorId,
      ok: checkResult.ok,
    })
    .from(checkResult)
    .innerJoin(
      latestBeforeWindow,
      and(
        eq(checkResult.monitorId, latestBeforeWindow.monitorId),
        eq(checkResult.createdAt, latestBeforeWindow.maxAt)
      )
    );

  const baselineOk = new Map<string, boolean>();
  for (const row of baselineRows) {
    baselineOk.set(row.monitorId, row.ok);
  }

  const windowWhere = [
    inArray(checkResult.monitorId, monitorIds),
    gte(checkResult.createdAt, since),
    ...(clearedAt ? [gt(checkResult.createdAt, clearedAt)] : []),
  ];

  const windowChecks = await db
    .select({
      id: checkResult.id,
      monitorId: checkResult.monitorId,
      ok: checkResult.ok,
      createdAt: checkResult.createdAt,
    })
    .from(checkResult)
    .where(and(...windowWhere))
    .orderBy(asc(checkResult.monitorId), asc(checkResult.createdAt));

  type TransitionRow = {
    id: string;
    monitorId: string;
    name: string;
    url: string;
    recovered: boolean;
    at: Date;
  };

  const transitions: TransitionRow[] = [];
  let i = 0;
  while (i < windowChecks.length) {
    const mid = windowChecks[i].monitorId;
    const meta = monitorById.get(mid);
    if (!meta) {
      i++;
      continue;
    }
    let prevOk: boolean | null = baselineOk.get(mid) ?? null;
    while (i < windowChecks.length && windowChecks[i].monitorId === mid) {
      const row = windowChecks[i];
      i++;
      if (prevOk !== null && prevOk !== row.ok) {
        transitions.push({
          id: row.id,
          monitorId: mid,
          name: meta.name,
          url: meta.url,
          recovered: row.ok,
          at: row.createdAt,
        });
      }
      prevOk = row.ok;
    }
  }

  transitions.sort((a, b) => b.at.getTime() - a.at.getTime());
  const capped = transitions.slice(0, MAX_EVENTS);
  const totalCount = capped.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1
      ? Math.min(pageRaw, totalPages)
      : 1;

  const start = (page - 1) * PAGE_SIZE;
  const pageSlice = capped.slice(start, start + PAGE_SIZE);
  const items = pageSlice.map((row) => ({
    ...row,
    at: row.at.toISOString(),
  }));

  return (
    <ActivityPageClient
      items={items}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
