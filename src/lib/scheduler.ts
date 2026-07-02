import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { runCheck } from "@/lib/run-check";
import { isMaintenanceActive } from "@/lib/monitor-config";
import { inArray, sql } from "drizzle-orm";
import { normalizeLocale } from "@/i18n/config";
import type { MonitorOwner } from "@/lib/monitor-owner";

/**
 * Run all monitors that are due for a check.
 * Called by the in-process scheduler (instrumentation.ts) and the HTTP cron endpoint.
 */
export async function runDueChecks(opts?: { jitter?: boolean }): Promise<{ ran: number }> {
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
    .select({ id: user.id, email: user.email, language: user.language })
    .from(user)
    .where(inArray(user.id, userIds));
  const ownerById = new Map<string, MonitorOwner>(
    users.map((u) => [
      u.id,
      { email: u.email, language: normalizeLocale(u.language) },
    ]),
  );

  const MAX_CONCURRENCY = 10;
  const MAX_JITTER_MS = 15_000;
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
    const useJitter = (opts?.jitter ?? true) && due.length > 1;
    const jitter = useJitter ? Math.floor(Math.random() * MAX_JITTER_MS) : 0;
    if (jitter > 0) await new Promise((r) => setTimeout(r, jitter));
    await acquire();
    const owner = ownerById.get(m.userId) ?? {
      email: "",
      language: normalizeLocale(null),
    };
    try {
      await runCheck(m, owner, { maintenanceActive: isMaintenanceActive(m, now) });
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
