import { db } from "@/db";
import { monitor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdminSubNav } from "@/components/admin-sub-nav";

export default async function AdminMonitorsPage() {
  const monitors = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      intervalMinutes: monitor.intervalMinutes,
      currentStatus: monitor.currentStatus,
      lastCheckAt: monitor.lastCheckAt,
      ownerEmail: user.email,
      ownerUsername: user.username,
    })
    .from(monitor)
    .innerJoin(user, eq(monitor.userId, user.id))
    .orderBy(user.email, monitor.name);
  const monitorsDown = monitors.filter((m) => m.currentStatus === false).length;
  const unchecked = monitors.filter((m) => m.currentStatus === null).length;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Fleet inventory
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Monitors</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              Inspect every configured check across user accounts.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg-card px-3 py-1 text-xs font-medium text-text-muted">
            {monitors.length} total · {monitorsDown} down · {unchecked} unchecked
          </div>
        </div>
      </div>
      <AdminSubNav />

      <div className="overflow-x-auto rounded-2xl border border-border bg-bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-page/60 text-left text-xs uppercase tracking-[0.12em] text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">URL</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last checked</th>
              <th className="px-4 py-3 font-medium">Interval</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-bg-page/50"
              >
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-text-muted">
                  <span title={m.url}>{m.url}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {m.ownerUsername ?? m.ownerEmail}
                </td>
                <td className="px-4 py-3">
                  {m.currentStatus === null ? (
                    <span className="inline-flex items-center rounded-full bg-bg-page px-2 py-0.5 text-xs font-medium text-text-muted">
                      Unchecked
                    </span>
                  ) : m.currentStatus ? (
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                      Up
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                      Down
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {m.lastCheckAt
                    ? m.lastCheckAt.toISOString().slice(0, 16).replace("T", " ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {m.intervalMinutes}m
                </td>
              </tr>
            ))}
            {monitors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="font-medium">No monitors yet</div>
                  <div className="mt-1 text-sm text-text-muted">
                    User-created monitors will appear here for admin review.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
