"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActivity } from "@/components/activity-context";

const links = [
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/monitors", labelKey: "monitors" as const },
  { href: "/activity", labelKey: "activity" as const },
] as const;

export function AppNavLinks({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const { unreadCount } = useActivity();
  const t = useTranslations("nav");

  return (
    <nav className="flex h-full items-stretch gap-1" aria-label={t("mainNav")}>
      {links.map(({ href, labelKey }) => {
        const label = t(labelKey);
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        const hasUnread = href === "/activity" && unreadCount > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 border-b-2 px-2 text-sm font-medium transition active:scale-95 ${
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
          className={`flex items-center border-b-2 px-2 text-sm font-medium transition active:scale-95 ${
            pathname.startsWith("/admin")
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
