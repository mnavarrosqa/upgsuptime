"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Monitor, Settings } from "lucide-react";

const NAV_LINKS = [
  { href: "/admin", labelKey: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "users", icon: Users, exact: false },
  { href: "/admin/monitors", labelKey: "monitors", icon: Monitor, exact: false },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, exact: false },
] as const;

const mobileLinkClass = cn(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
  "text-text-muted hover:text-text-primary",
  "border-b-2 border-transparent",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

const sidebarLinkClass = cn(
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
  "text-text-muted hover:bg-muted/50 hover:text-text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

export function AdminSubNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile: horizontal tabs */}
      <nav
        className="md:hidden -mx-4 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6"
        aria-label={t("ariaLabel")}
      >
        <div className="flex gap-1">
          {NAV_LINKS.map(({ href, labelKey, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  mobileLinkClass,
                  active && "border-accent text-text-primary"
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <nav
        className="hidden md:block w-56 shrink-0"
        aria-label={t("ariaLabel")}
      >
        <div className="flex flex-col gap-0.5">
          {NAV_LINKS.map(({ href, labelKey, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  sidebarLinkClass,
                  active && "bg-accent/10 text-accent"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
