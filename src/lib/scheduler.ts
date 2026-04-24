import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { runCheck } from "@/lib/run-check";
import { isMaintenanceActive } from "@/lib/monitor-config";
import { inArray, sql } from "drizzle-orm";

/**
 * Run all monitors that are due for a check.
 * Called by the in-process scheduler (instrumentation.ts) and the HTTP cron endpoint.
 */
export async function runDueChecks(): Promise<{ ran: number }> {
  const now = new Date();
  const nowUnixSeconds = Math.floor(now.getTime() / 1000);

  const due = await db
    .select()
    .from(monitor)
    .where(sql`
      COALESCE(${monitor.paused}, 0) = 0
      AND (
        ${monitor.lastCheckAt} IS NULL
        OR (${monitor.lastCheckAt} + (${monitor.intervalMinutes} * 60)) <= ${nowUnixSeconds}
      )
    `);

  if (due.length === 0) return { ran: 0 };

  const userIds = Array.from(new Set(due.map((m) => m.userId)));
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.id, userIds));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const MAX_CONCURRENCY = 10;
  let active = 0;
  const queue: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (active < MAX_CONCURRENCY) { active++; return Promise.resolve(); }
    return new Promise((resolve) => queue.push(resolve));
  }
  function release(): void {
    const next = queue.shift();
    if (next) { next(); } else { active--; }
  }

  let ran = 0;
  const tasks = due.map((m) => async () => {
    await acquire();
    const ownerEmail = emailById.get(m.userId) ?? "";
    try {
      await runCheck(m, ownerEmail, { maintenanceActive: isMaintenanceActive(m, now) });
      ran++;
    } catch (err) {
      console.error("[scheduler] check failed for monitor", m.id, err);
    } finally {
      release();
    }
  });

  await Promise.allSettled(tasks.map((t) => t()));
  return { ran };
}
