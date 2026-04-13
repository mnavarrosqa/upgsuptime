"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActivity } from "@/components/activity-context";
import {
  APP_PRIMARY_NAV_LINKS,
  isAdminNavActive,
  isPrimaryNavActive,
} from "@/lib/app-main-nav";

const navLinkClass =
  "relative flex items-center gap-1.5 border-b-2 px-2 text-sm font-medium transition motion-safe:active:scale-95";

export function AppNavLinks({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const { unreadCount } = useActivity();
  const t = useTranslations("nav");

  return (
    <nav className="flex h-full items-stretch gap-1" aria-label={t("mainNav")}>
      {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
        const label = t(labelKey);
        const active = isPrimaryNavActive(pathname, href);
        const hasUnread = href === "/activity" && unreadCount > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${navLinkClass} ${
              active
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
            {hasUnread && (
              <span className="h-2 w-2 rounded-full bg-red-500" aria-label={t("unreadIncidents")} />
            )}
          </Link>
        );
      })}
      {role === "admin" && (
        <Link
          href="/admin"
          aria-current={isAdminNavActive(pathname) ? "page" : undefined}
          className={`flex items-center border-b-2 px-2 text-sm font-medium transition motion-safe:active:scale-95 ${
            isAdminNavActive(pathname)
              ? "border-accent text-text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          {t("admin")}
        </Link>
      )}
    </nav>
  );
}
