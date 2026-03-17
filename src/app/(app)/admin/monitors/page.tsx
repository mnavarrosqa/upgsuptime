import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

interface AdminMonitor {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  currentStatus: boolean | null;
  lastCheckAt: string | null;
  createdAt: string;
  ownerEmail: string;
  ownerUsername: string | null;
}

async function getMonitors(): Promise<AdminMonitor[]> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/admin/monitors`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function AdminMonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const monitors = await getMonitors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">All Monitors</h1>
        <p className="mt-1 text-sm text-text-muted">
          {monitors.length} monitor{monitors.length !== 1 ? "s" : ""} across all users
        </p>
      </div>

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
                    ? new Date(m.lastCheckAt).toLocaleString()
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
