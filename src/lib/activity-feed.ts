import { db } from "@/db";
import { monitor, user, checkResult, degradationAlertEvent } from "@/db/schema";
import { eq, and, gte, gt, lt, inArray, max, asc } from "drizzle-orm";
import { daysAgoUtc } from "@/lib/server-relative-time";
import { parseActivityDismissedIds } from "@/lib/activity-dismissed-ids";
import type { ActivityItem } from "@/lib/activity-item";

export const ACTIVITY_FEED_MAX_EVENTS = 50;
export const ACTIVITY_FEED_WINDOW_DAYS = 7;

export async function loadActivityFeed(userId: string): Promise<ActivityItem[]> {
  const since = daysAgoUtc(ACTIVITY_FEED_WINDOW_DAYS);

  const [[currentUser], monitors] = await Promise.all([
    db
      .select({
        activityClearedAt: user.activityClearedAt,
        activityDismissedIds: user.activityDismissedIds,
      })
      .from(user)
      .where(eq(user.id, userId)),
    db
      .select({ id: monitor.id, name: monitor.name, url: monitor.url })
      .from(monitor)
      .where(eq(monitor.userId, userId)),
  ]);

  const clearedAt = currentUser?.activityClearedAt ?? null;
  const monitorIds = monitors.map((m) => m.id);
  const monitorById = new Map(monitors.map((m) => [m.id, m]));

  if (monitorIds.length === 0) return [];

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

  const degWhere = [
    inArray(degradationAlertEvent.monitorId, monitorIds),
    gte(degradationAlertEvent.createdAt, since),
    ...(clearedAt ? [gt(degradationAlertEvent.createdAt, clearedAt)] : []),
  ];

  const [windowChecks, degradationRows] = await Promise.all([
    db
      .select({
        id: checkResult.id,
        monitorId: checkResult.monitorId,
        ok: checkResult.ok,
        createdAt: checkResult.createdAt,
      })
      .from(checkResult)
      .where(and(...windowWhere))
      .orderBy(asc(checkResult.monitorId), asc(checkResult.createdAt)),
    db
      .select({
        id: degradationAlertEvent.id,
        monitorId: degradationAlertEvent.monitorId,
        createdAt: degradationAlertEvent.createdAt,
        recentAvgMs: degradationAlertEvent.recentAvgMs,
        baselineP75Ms: degradationAlertEvent.baselineP75Ms,
      })
      .from(degradationAlertEvent)
      .where(and(...degWhere)),
  ]);

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

  const degradationEvents = degradationRows.flatMap((d) => {
    const meta = monitorById.get(d.monitorId);
    if (!meta) return [];
    return [
      {
        kind: "degradation" as const,
        id: d.id,
        monitorId: d.monitorId,
        name: meta.name,
        url: meta.url,
        recentAvgMs: d.recentAvgMs,
        baselineP75Ms: d.baselineP75Ms,
        at: d.createdAt,
      },
    ];
  });

  const statusEvents = transitions.map((t) => ({
    kind: "status" as const,
    id: t.id,
    monitorId: t.monitorId,
    name: t.name,
    url: t.url,
    recovered: t.recovered,
    at: t.at,
  }));

  const merged = [...statusEvents, ...degradationEvents].sort(
    (a, b) => b.at.getTime() - a.at.getTime()
  );
  const dismissed = parseActivityDismissedIds(currentUser?.activityDismissedIds);
  const mergedFiltered = merged.filter((e) => !dismissed.has(e.id));
  const capped = mergedFiltered.slice(0, ACTIVITY_FEED_MAX_EVENTS);

  return capped.map((row) => {
    if (row.kind === "status") {
      return {
        kind: "status" as const,
        id: row.id,
        monitorId: row.monitorId,
        name: row.name,
        url: row.url,
        recovered: row.recovered,
        at: row.at.toISOString(),
      };
    }
    return {
      kind: "degradation" as const,
      id: row.id,
      monitorId: row.monitorId,
      name: row.name,
      url: row.url,
      recentAvgMs: row.recentAvgMs,
      baselineP75Ms: row.baselineP75Ms,
      at: row.at.toISOString(),
    };
  });
}
