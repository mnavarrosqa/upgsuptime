"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Monitor, Settings } from "lucide-react";
import { APP_ADMIN_NAV_LINKS, isAdminChildActive } from "@/lib/app-main-nav";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
  "/admin/users": Users,
  "/admin/monitors": Monitor,
  "/admin/settings": Settings,
};

const mobileLinkClass = cn(
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
  "text-text-muted hover:text-text-primary",
  "border-b-2 border-transparent",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

export function AdminSubNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <nav
      className="md:hidden -mx-4 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6"
      aria-label={t("ariaLabel")}
    >
      <div className="flex gap-1">
        {APP_ADMIN_NAV_LINKS.map(({ href, labelKey, exact }) => {
          const active = isAdminChildActive(pathname, href, exact);
          const Icon = ICONS[href];
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(mobileLinkClass, active && "border-accent text-text-primary")}
            >
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {t(labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
