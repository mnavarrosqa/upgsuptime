"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Bell, ShieldCheck } from "lucide-react";
import { useActivity } from "@/components/activity-context";
import {
  APP_PRIMARY_NAV_LINKS,
  isAdminNavActive,
  isPrimaryNavActive,
} from "@/lib/app-main-nav";

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/activity": Bell,
  "/admin": ShieldCheck,
};

const linkBase =
  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors motion-safe:active:scale-[0.97]";

export function AppNavLinks({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const { unreadCount } = useActivity();
  const t = useTranslations("nav");

  return (
    <nav className="flex items-center gap-0.5" aria-label={t("mainNav")}>
      {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
        const label = t(labelKey);
        const active = isPrimaryNavActive(pathname, href);
        const hasUnread = href === "/activity" && unreadCount > 0;
        const Icon = NAV_ICONS[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${linkBase} ${
              active
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-bg-page hover:text-text-primary"
            }`}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {label}
            {hasUnread && (
              <span className="size-1.5 rounded-full bg-status-down" aria-label={t("unreadIncidents")} />
            )}
          </Link>
        );
      })}
      {role === "admin" && (() => {
        const active = isAdminNavActive(pathname);
        const Icon = NAV_ICONS["/admin"]!;
        return (
          <Link
            href="/admin"
            aria-current={active ? "page" : undefined}
            className={`${linkBase} ${
              active
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-bg-page hover:text-text-primary"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {t("admin")}
          </Link>
        );
      })()}
    </nav>
  );
}
