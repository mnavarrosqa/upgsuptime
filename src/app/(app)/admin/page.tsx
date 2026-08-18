import Link from "next/link";
import { db } from "@/db";
import { user, monitor, checkResult } from "@/db/schema";
import { count, eq, gte } from "drizzle-orm";
import { hoursAgoUtc } from "@/lib/server-relative-time";
import { Activity, ArrowRight, CheckCircle2, Monitor, Users, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("admin");
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
    { label: t("overview.cardUsers"), value: totalUsers, detail: t("overview.cardUsersDetail"), icon: Users },
    { label: t("overview.cardMonitors"), value: totalMonitors, detail: t("overview.cardMonitorsDetail"), icon: Monitor },
    { label: t("overview.cardChecks"), value: checksLast24h, detail: t("overview.cardChecksDetail"), icon: Activity },
    {
      label: t("overview.cardUp"),
      value: monitorsUp,
      detail: upRate === null ? t("overview.cardUpDetailNoStatus") : t("overview.cardUpDetailRate", { upRate }),
      icon: CheckCircle2,
      tone: "text-status-up",
    },
    {
      label: t("overview.cardDown"),
      value: monitorsDown,
      detail: monitorsDown === 0 ? t("overview.cardDownDetailGood") : t("overview.cardDownDetailBad"),
      icon: XCircle,
      tone: monitorsDown > 0 ? "text-status-down" : "text-text-muted",
    },
  ];

  const quickLinks = [
    { href: "/admin/users", label: t("overview.usersLabel"), desc: t("overview.usersDesc") },
    { href: "/admin/monitors", label: t("overview.monitorsLabel"), desc: t("overview.monitorsDesc") },
    { href: "/admin/settings", label: t("overview.settingsLabel"), desc: t("overview.settingsDesc") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2
          className="text-lg font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("overview.eyebrow")}
        </h2>
        <span className="rounded-full border border-border bg-bg-card px-3 py-1 text-xs font-medium text-text-muted">
          {t("overview.last24h")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-text-muted">{label}</div>
              <Icon className={`size-4 ${tone ?? "text-text-muted"}`} aria-hidden />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </div>
            <div className="mt-1 text-xs text-text-muted">{detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-center justify-between gap-3 font-medium text-sm">
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
