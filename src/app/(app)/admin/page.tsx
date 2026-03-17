import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

interface Stats {
  totalUsers: number;
  totalMonitors: number;
  checksLast24h: number;
  monitorsUp: number;
  monitorsDown: number;
}

async function getStats(): Promise<Stats> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/admin/stats`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const stats = await getStats();

  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Total monitors", value: stats.totalMonitors },
    { label: "Checks (last 24h)", value: stats.checksLast24h },
    { label: "Monitors up", value: stats.monitorsUp },
    { label: "Monitors down", value: stats.monitorsDown },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin Overview</h1>
        <p className="mt-1 text-sm text-text-muted">System-wide statistics</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-bg-card p-4"
          >
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/users", label: "Users", desc: "Manage user accounts and roles" },
          { href: "/admin/monitors", label: "Monitors", desc: "View all monitors across all users" },
          { href: "/admin/settings", label: "Settings", desc: "Configure app-wide settings" },
        ].map(({ href, label, desc }) => (
          <a
            key={href}
            href={href}
            className="rounded-lg border border-border bg-bg-card p-4 transition-colors hover:border-accent"
          >
            <div className="font-medium">{label}</div>
            <div className="mt-1 text-sm text-text-muted">{desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
