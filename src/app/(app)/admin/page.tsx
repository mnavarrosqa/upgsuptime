import Link from "next/link";
import { db } from "@/db";
import { user, monitor, checkResult } from "@/db/schema";
import { count, eq, gte } from "drizzle-orm";
import { AdminSubNav } from "@/components/admin-sub-nav";
import { hoursAgoUtc } from "@/lib/server-relative-time";
import { Activity, ArrowRight, CheckCircle2, Monitor, Users, XCircle } from "lucide-react";

export default async function AdminPage() {
  const since = hoursAgoUtc(24);

  const [[{ totalUsers }], [{ totalMonitors }], [{ checksLast24h }], [{ monitorsUp }], [{ monitorsDown }]] =
    await Promise.all([
      db.select({ totalUsers: count() }).from(user),
      db.select({ totalMonitors: count() }).from(monitor),
      db.select({ checksLast24h: count() }).from(checkResult).where(gte(checkResult.createdAt, since)),
      db.select({ monitorsUp: count() }).from(monitor).where(eq(monitor.currentStatus, true)),
      db.select({ monitorsDown: count() }).from(monitor).where(eq(monitor.currentStatus, false)),
    ]);

  const knownStatusCount = monitorsUp + monitorsDown;
  const upRate =
    knownStatusCount > 0 ? Math.round((monitorsUp / knownStatusCount) * 100) : null;

  const cards = [
    { label: "Users", value: totalUsers, detail: "registered accounts", icon: Users },
    { label: "Monitors", value: totalMonitors, detail: "configured checks", icon: Monitor },
    { label: "Checks", value: checksLast24h, detail: "completed in 24h", icon: Activity },
    {
      label: "Up",
      value: monitorsUp,
      detail: upRate === null ? "no checked monitors" : `${upRate}% of known statuses`,
      icon: CheckCircle2,
      tone: "text-green-600 dark:text-green-400",
    },
    {
      label: "Down",
      value: monitorsDown,
      detail: monitorsDown === 0 ? "no active outages" : "needs attention",
      icon: XCircle,
      tone: monitorsDown > 0 ? "text-red-600 dark:text-red-400" : "text-text-muted",
    },
  ];

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Control room
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              System-wide visibility for accounts, checks, and operational settings.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg-card px-3 py-1 text-xs font-medium text-text-muted">
            Last 24 hours
          </div>
        </div>
      </div>
      <AdminSubNav />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-text-muted">{label}</div>
              <Icon className={`size-4 ${tone ?? "text-text-muted"}`} aria-hidden />
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </div>
            <div className="mt-1 text-xs text-text-muted">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/users", label: "Users", desc: "Manage user accounts and roles" },
          { href: "/admin/monitors", label: "Monitors", desc: "View all monitors across all users" },
          { href: "/admin/settings", label: "Settings", desc: "Configure app-wide settings" },
        ].map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-bg-card p-4 transition-[border-color,background-color,transform] duration-200 hover:border-accent hover:bg-bg-card motion-safe:hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-3 font-medium">
              {label}
              <ArrowRight
                className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <div className="mt-1 text-sm text-text-muted">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
