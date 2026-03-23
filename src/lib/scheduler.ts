import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { runCheck } from "@/lib/run-check";

/**
 * Run all monitors that are due for a check.
 * Called by the in-process scheduler (instrumentation.ts) and the HTTP cron endpoint.
 */
export async function runDueChecks(): Promise<{ ran: number }> {
  const now = new Date();

  // Fetch monitors and users separately with plain db.select().from() — the
  // same flat select used by check-now — so Drizzle applies all per-column
  // type mappers (mode:"boolean" etc.) correctly without any join ambiguity.
  const [monitors, users] = await Promise.all([
    db.select().from(monitor),
    db.select().from(user),
  ]);

  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const due = monitors.filter((m) => {
    if (m.paused) return false;
    if (!m.lastCheckAt) return true;
    const dueAt = m.lastCheckAt.getTime() + m.intervalMinutes * 60 * 1000;
    return dueAt <= now.getTime();
  });

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
      await runCheck(m, ownerEmail);
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
