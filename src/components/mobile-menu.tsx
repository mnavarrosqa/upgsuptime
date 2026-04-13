"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, X, Sun, Moon, User, LogOut, CircleHelp, Globe } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useActivity } from "@/components/activity-context";
import { Button } from "@/components/ui/button";
import {
  APP_PRIMARY_NAV_LINKS,
  isAdminNavActive,
  isPrimaryNavActive,
} from "@/lib/app-main-nav";

export function MobileMenu({
  role,
  email,
  name,
}: {
  role?: string | null;
  email: string;
  name?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { unreadCount } = useActivity();
  const t = useTranslations("nav");
  const tLocale = useTranslations("locale");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.classList.contains("dark") ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
  }, []);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onClickOutside);
    };
  }, [open]);

  async function switchLanguage() {
    const next = locale === "en" ? "es" : "en";
    setSwitchingLocale(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    } finally {
      setSwitchingLocale(false);
    }
  }

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((o) => !o)}
        className="h-11 w-11 rounded-md text-text-muted hover:bg-bg-page hover:text-text-primary"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-bg-card py-1 shadow-lg"
          role="menu"
          aria-label={t("navMenu")}
        >
          {/* User info */}
          <div className="border-b border-border px-3 py-2.5">
            {name && (
              <p className="truncate text-sm font-medium text-text-primary">{name}</p>
            )}
            <p
              className={`truncate text-xs ${name ? "text-text-muted" : "font-medium text-text-primary"}`}
            >
              {email}
            </p>
          </div>

          {/* Nav links */}
          {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
            const label = t(labelKey);
            const active = isPrimaryNavActive(pathname, href);
            const hasUnread = href === "/activity" && unreadCount > 0;
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "font-medium text-text-primary"
                    : "text-text-muted hover:bg-bg-page hover:text-text-primary"
                }`}
              >
                {label}
                {hasUnread && (
                  <span
                    className="h-2 w-2 rounded-full bg-red-500"
                    aria-label={t("unreadIncidents")}
                  />
                )}
              </Link>
            );
          })}
          {role === "admin" && (
            <Link
              href="/admin"
              role="menuitem"
              aria-current={isAdminNavActive(pathname) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center px-3 py-2 text-sm transition-colors ${
                isAdminNavActive(pathname)
                  ? "font-medium text-text-primary"
                  : "text-text-muted hover:bg-bg-page hover:text-text-primary"
              }`}
            >
              {t("admin")}
            </Link>
          )}

          <div className="my-1 border-t border-border" />

          {/* Theme toggle */}
          {mounted && (
            <Button
              type="button"
              variant="ghost"
              onClick={toggleTheme}
              className="h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-2 text-sm font-normal text-text-muted shadow-none hover:bg-bg-page hover:text-text-primary"
            >
              {dark ? (
                <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {dark ? t("lightMode") : t("darkMode")}
            </Button>
          )}

          {/* Language toggle */}
          <Button
            type="button"
            variant="ghost"
            onClick={switchLanguage}
            disabled={switchingLocale}
            className="h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-2 text-sm font-normal text-text-muted shadow-none hover:bg-bg-page hover:text-text-primary"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {locale === "en" ? tLocale("spanish") : tLocale("english")}
          </Button>

          {/* Account & sign out */}
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
          >
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("account")}
          </Link>
          <Link
            href="/help"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("help")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="h-auto w-full justify-start gap-2 rounded-none border-0 px-3 py-2 text-sm font-normal text-text-muted shadow-none hover:bg-bg-page hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      )}
    </div>
  );
}
