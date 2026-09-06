import { db } from "@/db";
import { monitor, user, checkResult, degradationAlertEvent } from "@/db/schema";
import { eq, and, gte, gt, lt, inArray, max, sql } from "drizzle-orm";
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

  const windowWhere = [
    inArray(checkResult.monitorId, monitorIds),
    gte(checkResult.createdAt, since),
    ...(clearedAt ? [gt(checkResult.createdAt, clearedAt)] : []),
  ];

  const ordered = db.$with("ordered_checks").as(
    db
      .select({
        id: checkResult.id,
        monitorId: checkResult.monitorId,
        ok: checkResult.ok,
        createdAt: checkResult.createdAt,
        prevOk: sql<boolean | null>`lag(${checkResult.ok}) over (partition by ${checkResult.monitorId} order by ${checkResult.createdAt})`.as(
          "prevOk"
        ),
        rn: sql<number>`row_number() over (partition by ${checkResult.monitorId} order by ${checkResult.createdAt})`.as(
          "rn"
        ),
      })
      .from(checkResult)
      .where(and(...windowWhere))
  );

  const degWhere = [
    inArray(degradationAlertEvent.monitorId, monitorIds),
    gte(degradationAlertEvent.createdAt, since),
    ...(clearedAt ? [gt(degradationAlertEvent.createdAt, clearedAt)] : []),
  ];

  const [baselineRows, changeRows, degradationRows] = await Promise.all([
    db
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
      ),
    db
      .with(ordered)
      .select({
        id: ordered.id,
        monitorId: ordered.monitorId,
        ok: ordered.ok,
        createdAt: ordered.createdAt,
        prevOk: ordered.prevOk,
        rn: ordered.rn,
      })
      .from(ordered)
      .where(
        sql`(${ordered.prevOk} is not null and ${ordered.prevOk} != ${ordered.ok}) or ${ordered.rn} = 1`
      ),
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

  const baselineOk = new Map<string, boolean>();
  for (const row of baselineRows) {
    baselineOk.set(row.monitorId, row.ok);
  }

  type TransitionRow = {
    id: string;
    monitorId: string;
    name: string;
    url: string;
    recovered: boolean;
    at: Date;
  };

  const transitions: TransitionRow[] = [];
  for (const row of changeRows) {
    const meta = monitorById.get(row.monitorId);
    if (!meta) continue;
    const prev =
      row.rn === 1
        ? (baselineOk.get(row.monitorId) ?? null)
        : row.prevOk == null
          ? null
          : Boolean(row.prevOk);
    if (prev === null || prev === row.ok) continue;
    transitions.push({
      id: row.id,
      monitorId: row.monitorId,
      name: meta.name,
      url: meta.url,
      recovered: row.ok,
      at: row.createdAt,
    });
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
