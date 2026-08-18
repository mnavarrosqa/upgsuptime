"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import { Menu, X, Sun, Moon, User, LogOut, CircleHelp, Globe, LayoutDashboard, Bell, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.classList.contains("dark") ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
  }, []);

  const closeMenu = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;

      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    function onClickOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onClickOutside);
    requestAnimationFrame(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstItem?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onClickOutside);
    };
  }, [closeMenu, open]);

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

  const menuItemClass =
    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary";

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border/60 bg-bg-card shadow-xl shadow-black/10"
          role="menu"
          aria-label={t("navMenu")}
        >
          {/* User info */}
          <div className="border-b border-border px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : email.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                {name && (
                  <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                )}
                <p className={`truncate text-xs ${name ? "text-text-muted" : "font-medium text-text-primary"}`}>
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div className="py-1">
            {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
              const label = t(labelKey);
              const active = isPrimaryNavActive(pathname, href);
              const hasUnread = href === "/activity" && unreadCount > 0;
              const Icon = NAV_ICONS[href];
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => closeMenu()}
                  className={`${menuItemClass} ${active ? "font-medium text-accent" : ""}`}
                >
                  {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                  {label}
                  {hasUnread && (
                    <span
                      className="size-1.5 rounded-full bg-status-down"
                      aria-label={t("unreadIncidents")}
                    />
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
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => closeMenu()}
                  className={`${menuItemClass} ${active ? "font-medium text-accent" : ""}`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t("admin")}
                </Link>
              );
            })()}
          </div>

          <div className="border-t border-border" />

          {/* Preferences */}
          <div className="py-1">
            {mounted && (
              <button
                type="button"
                role="menuitem"
                onClick={toggleTheme}
                className={menuItemClass}
              >
                {dark ? (
                  <Sun className="size-4 shrink-0" aria-hidden />
                ) : (
                  <Moon className="size-4 shrink-0" aria-hidden />
                )}
                {dark ? t("lightMode") : t("darkMode")}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={switchLanguage}
              disabled={switchingLocale}
              className={`${menuItemClass} disabled:opacity-50`}
            >
              <Globe className="size-4 shrink-0" aria-hidden />
              {locale === "en" ? tLocale("spanish") : tLocale("english")}
            </button>
          </div>

          <div className="border-t border-border" />

          {/* Account & sign out */}
          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => closeMenu()}
              className={menuItemClass}
            >
              <User className="size-4 shrink-0" aria-hidden />
              {t("account")}
            </Link>
            <Link
              href="/help"
              role="menuitem"
              onClick={() => closeMenu()}
              className={menuItemClass}
            >
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              {t("help")}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={menuItemClass}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
