"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/monitors", label: "Monitors" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="overflow-x-auto rounded-xl border border-border bg-bg-card/70 p-1"
      aria-label="Admin navigation"
    >
      <div className="flex min-w-max gap-1">
        {links.map(({ href, label }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color,box-shadow] duration-200 ${
                active
                  ? "bg-bg-page text-text-primary shadow-sm"
                  : "text-text-muted hover:bg-bg-page/70 hover:text-text-primary"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
