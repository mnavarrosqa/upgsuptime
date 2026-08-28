"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Monitor,
  Bell,
  ShieldCheck,
  Users,
  Settings,
  User,
  LogOut,
  BookOpen,
  CircleHelp,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useActivity } from "@/components/activity-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  APP_ADMIN_NAV_LINKS,
  APP_PRIMARY_NAV_LINKS,
  isAdminChildActive,
  isPrimaryNavActive,
} from "@/lib/app-main-nav";

const PRIMARY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/monitors": Monitor,
  "/activity": Bell,
};

const ADMIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
  "/admin/users": Users,
  "/admin/monitors": Monitor,
  "/admin/settings": Settings,
};

const linkClass =
  "relative flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors";

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function AppSidebar({
  role,
  email,
  name,
  onNavigate,
  showClose,
}: {
  role?: string | null;
  email: string;
  name?: string | null;
  onNavigate?: () => void;
  showClose?: boolean;
}) {
  const pathname = usePathname();
  const { unreadCount } = useActivity();
  const t = useTranslations("nav");
  const tAdmin = useTranslations("admin.nav");

  const itemClass = (active: boolean) =>
    cn(
      linkClass,
      active
        ? "bg-accent/10 text-accent"
        : "text-text-muted hover:bg-bg-page hover:text-text-primary"
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 pr-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-5 text-sm font-semibold text-text-primary transition-opacity hover:opacity-80"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <BrandMark className="size-5 shrink-0" />
          <span className="truncate">{t("appTitle")}</span>
        </Link>
        {showClose ? (
          <button
            type="button"
            onClick={onNavigate}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
            aria-label={t("closeMenu")}
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label={t("mainNav")}>
        <div className="flex flex-col gap-0.5">
          {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
            const label = t(labelKey);
            const active = isPrimaryNavActive(pathname, href);
            const hasUnread = href === "/activity" && unreadCount > 0;
            const Icon = PRIMARY_ICONS[href];
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {hasUnread && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-status-down"
                    aria-label={t("unreadIncidents")}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {role === "admin" && (
          <div className="mt-6">
            <p className="mb-1 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("admin")}
            </p>
            <div className="flex flex-col gap-0.5">
              {APP_ADMIN_NAV_LINKS.map(({ href, labelKey, exact }) => {
                const active = isAdminChildActive(pathname, href, exact);
                const Icon = ADMIN_ICONS[href];
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={itemClass(active)}
                  >
                    {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{tAdmin(labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-border/60 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="mb-2 flex items-center gap-2.5 px-1 py-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            {getInitials(name, email)}
          </span>
          <div className="min-w-0">
            {name && (
              <p className="truncate text-sm font-medium text-text-primary">{name}</p>
            )}
            <p
              className={cn(
                "truncate text-xs",
                name ? "text-text-muted" : "font-medium text-text-primary"
              )}
            >
              {email}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <Link href="/account" onClick={onNavigate} className={itemClass(pathname.startsWith("/account"))}>
            <User className="size-4 shrink-0" aria-hidden />
            {t("account")}
          </Link>
          <Link href="/help" onClick={onNavigate} className={itemClass(pathname.startsWith("/help"))}>
            <CircleHelp className="size-4 shrink-0" aria-hidden />
            {t("help")}
          </Link>
          <Link
            href="/account#onboarding"
            onClick={onNavigate}
            className={itemClass(false)}
          >
            <BookOpen className="size-4 shrink-0" aria-hidden />
            {t("onboardingGuide")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onNavigate?.();
              void signOut({ callbackUrl: "/login" });
            }}
            className={cn(
              linkClass,
              "h-auto w-full justify-start border-0 px-3 font-medium text-text-muted shadow-none hover:bg-bg-page hover:text-text-primary"
            )}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
