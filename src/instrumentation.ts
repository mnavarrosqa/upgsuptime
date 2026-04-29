export async function register() {
  // Skip the Edge runtime — croner only works in Node.js
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Guard against double-registration within one Node process, including
  // Next.js dev mode fast refresh. This is not a distributed lock: production
  // deployments with multiple Node instances should nominate one scheduler
  // owner or use only the authenticated HTTP cron endpoint.
  const g = global as typeof globalThis & { __schedulerStarted?: boolean };
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;

  const { Cron } = await import("croner");
  const { runDueChecks } = await import("./lib/scheduler");

  // Tick every 30 seconds. protect:true prevents overlapping runs.
  new Cron("*/30 * * * * *", { protect: true }, async () => {
    try {
      const { ran } = await runDueChecks();
      if (ran > 0) {
        console.log(`[scheduler] ran ${ran} check(s)`);
      }
    } catch (err) {
      console.error("[scheduler] tick error:", err);
    }
  });

  console.log("[scheduler] started — ticking every 30s");
}
