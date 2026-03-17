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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
      </div>
      <AdminSubNav />

      <p className="text-sm text-text-muted">
        {monitors.length} monitor{monitors.length !== 1 ? "s" : ""} across all users
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-card text-left text-xs text-text-muted">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">URL</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last checked</th>
              <th className="px-4 py-2 font-medium">Interval</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-text-muted">
                  <span title={m.url}>{m.url}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {m.ownerUsername ?? m.ownerEmail}
                </td>
                <td className="px-4 py-3">
                  {m.currentStatus === null ? (
                    <span className="text-text-muted">—</span>
                  ) : m.currentStatus ? (
                    <span className="text-green-600 dark:text-green-400">Up</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">Down</span>
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
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No monitors yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
