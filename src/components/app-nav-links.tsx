"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActivity } from "@/components/activity-context";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/monitors", label: "Monitors" },
  { href: "/activity", label: "Activity" },
] as const;

export function AppNavLinks({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const { unreadCount } = useActivity();

  return (
    <nav className="flex h-full min-w-0 flex-1 items-stretch gap-0 overflow-x-auto" aria-label="Main navigation">
      {links.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        const hasUnread = href === "/activity" && unreadCount > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 border-b-2 px-1.5 text-sm font-medium transition active:scale-95 sm:px-2 ${
              active
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
            {hasUnread && (
              <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread incidents" />
            )}
          </Link>
        );
      })}
      {role === "admin" && (
        <Link
          href="/admin"
          className={`flex items-center border-b-2 px-1.5 text-sm font-medium transition active:scale-95 sm:px-2 ${
            pathname.startsWith("/admin")
              ? "border-accent text-text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
