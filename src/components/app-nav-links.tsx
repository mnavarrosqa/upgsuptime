"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/monitors", label: "Monitors" },
] as const;

export function AppNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full items-stretch gap-1" aria-label="Main navigation">
      {links.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center border-b-2 px-2 text-sm font-medium transition-colors ${
              active
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
