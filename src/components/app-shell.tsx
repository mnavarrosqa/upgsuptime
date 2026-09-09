"use client";

import { useTransition, useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useTranslations } from "next-intl";
import { Bell, BookOpen, CircleHelp, PanelsTopLeft, LogOut, MonitorCheck, Settings2, ShieldCheck, CircleUserRound, UsersRound, ServerCog, Menu } from "lucide-react";
import { useActivity } from "@/components/activity-context";
import { Spinner } from "@/components/spinner";
import { BrandMark } from "@/components/brand-mark";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";
import { hrefPath, isPrimaryNavActive, isAdminChildActive, APP_ADMIN_NAV_LINKS, APP_PRIMARY_NAV_LINKS } from "@/lib/app-main-nav";

const MOBILE_NAV_ICONS = {
  "/dashboard": PanelsTopLeft,
  "/monitors": MonitorCheck,
  "/activity": Bell,
  "/admin": ShieldCheck,
  "/admin/users": UsersRound,
  "/admin/monitors": ServerCog,
  "/admin/settings": Settings2,
};

export function AppShell({
  role,
  email,
  name,
  children,
}: {
  role?: string | null;
  email: string;
  name?: string | null;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const { unreadCount } = useActivity();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const moreRef = useRef<HTMLDivElement>(null);
  const moreId = useId();
  const tAdmin = useTranslations("admin.nav");
  const navigatingTo = isPending && pendingHref ? pendingHref : null;
  const highlightPath = navigatingTo ? hrefPath(navigatingTo) : pathname;
  const mobileLinks = [
    ...APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => ({
      href, label: t(labelKey), Icon: MOBILE_NAV_ICONS[href], exact: href === "/dashboard",
    })),
    { href: "/account", label: t("account"), Icon: CircleUserRound, exact: false },
    { href: "/help", label: t("help"), Icon: CircleHelp, exact: false },
    ...(role === "admin" ? APP_ADMIN_NAV_LINKS.map(({ href, labelKey, exact }) => ({
      href, label: tAdmin(labelKey), Icon: MOBILE_NAV_ICONS[href], exact,
    })) : []),
    { href: "/account#onboarding", label: t("onboardingGuide"), Icon: BookOpen, exact: false },
  ];
  const isMobileActive = (path: string, href: string, exact: boolean) =>
    !href.includes("#") && (href.startsWith("/admin")
      ? isAdminChildActive(path, href, exact)
      : isPrimaryNavActive(path, href));
  const currentSection = mobileLinks.find(({ href, exact }) =>
    isMobileActive(highlightPath, href, exact)
  )?.label;
  const primaryDock = mobileLinks.slice(0, 4);
  const overflowDock = mobileLinks.slice(4);
  const overflowActive = overflowDock.some(({ href, exact }) =>
    isMobileActive(highlightPath, href, exact)
  );
  const dockActiveIndex = overflowActive
    ? 4
    : primaryDock.findIndex(({ href, exact }) => isMobileActive(highlightPath, href, exact));

  const onNavigate = useCallback(
    (href: string) => {
      moreRef.current?.hidePopover();
      if (href === pathname) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router]
  );

  return (
    <div className="min-h-svh bg-bg-page text-text-primary md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden h-svh flex-col border-r border-border/60 bg-bg-card md:flex">
        <AppSidebar
          role={role}
          email={email}
          name={name}
          activePath={highlightPath}
          pending={Boolean(navigatingTo)}
          onNavigate={onNavigate}
        />
      </aside>

      <div className="relative flex min-w-0 flex-col">
        {navigatingTo && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-accent/20"
            aria-hidden
          >
            <div className="h-full w-1/3 bg-accent motion-safe:animate-pulse" />
          </div>
        )}
        <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-bg-card md:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4">
            <Link
              href="/dashboard"
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                if (hrefPath("/dashboard") === pathname) return;
                event.preventDefault();
                onNavigate("/dashboard");
              }}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg text-text-primary transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <BrandMark className="size-6 shrink-0" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("truncate font-semibold", currentSection ? "text-[11px] leading-4 text-text-muted" : "text-sm")}>{t("appTitle")}</span>
                {currentSection && <span className="truncate text-sm font-semibold leading-5">{currentSection}</span>}
              </span>
            </Link>
            <div className="flex shrink-0 items-center rounded-xl border border-border/60 bg-bg-page/60 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:touch-manipulation [&_button]:focus-visible:outline-2 [&_button]:focus-visible:-outline-offset-2 [&_button]:focus-visible:outline-ring">
              <div className="flex min-h-11 items-center"><LanguageToggle /></div>
              <span className="h-4 w-px bg-border/80" aria-hidden />
              <div className="flex size-11 items-center justify-center"><ThemeToggle /></div>
            </div>
          </div>
        </header>
        <nav aria-label={t("mainNav")} className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.25rem)] z-30 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-bg-card px-1 py-1 shadow-[0_4px_24px_-12px_rgb(0_0_0/0.18),inset_0_1px_0_0_rgb(255_255_255/0.3)] supports-[backdrop-filter:blur(1px)]:bg-bg-card/65 supports-[backdrop-filter:blur(1px)]:backdrop-blur-2xl supports-[backdrop-filter:blur(1px)]:backdrop-saturate-150 md:hidden">
          <div className="relative grid grid-cols-5">
            {dockActiveIndex >= 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 rounded-lg bg-primary/10 motion-safe:transition-transform motion-safe:duration-300 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)]"
                style={{ transform: `translate3d(${dockActiveIndex * 100}%, 0, 0)` }}
              />
            )}
            {primaryDock.map(({ href, label, Icon, exact }) => {
            const active = isMobileActive(highlightPath, href, exact);
            const pending = navigatingTo === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isMobileActive(pathname, href, exact) ? "page" : undefined}
                aria-busy={pending || undefined}
                title={label}
                className={cn(
                  "group relative z-[1] flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 touch-manipulation transition-colors motion-safe:transition-[color,transform] motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)] motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "text-primary"
                    : "text-text-muted hover:text-text-primary"
                )}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  if (href === pathname) return;
                  event.preventDefault();
                  onNavigate(href);
                }}
              >
                <span className={cn(
                  "relative flex size-5 shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)]",
                  active ? "motion-safe:scale-110" : "motion-safe:group-hover:-translate-y-0.5"
                )}>
                  {pending ? <Spinner size="sm" /> : <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />}
                  {href === "/activity" && unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-down ring-2 ring-bg-card">
                      <span className="sr-only">{t("unreadIncidents")}</span>
                    </span>
                  )}
                </span>
                <span className={cn("max-w-full text-center text-[10px] leading-tight text-balance sm:text-[11px]", active ? "font-semibold" : "font-normal")}>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            popoverTarget={moreId}
            className={cn(
              "relative z-[1] flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 touch-manipulation transition-colors motion-safe:transition-[color,transform] motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)] motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              overflowActive ? "text-primary" : "text-text-muted"
            )}
          >
            <span className={cn(
              "flex size-5 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)]",
              overflowActive && "motion-safe:scale-110"
            )}>
              <Menu className="size-5" strokeWidth={overflowActive ? 2.25 : 1.75} aria-hidden />
            </span>
            <span className="max-w-full text-center text-[10px] leading-tight sm:text-[11px]">{t("more")}</span>
          </button>
          </div>
        </nav>
        <div
          ref={moreRef}
          id={moreId}
          popover="auto"
          aria-label={t("more")}
          className="fixed inset-x-3 top-auto bottom-[calc(env(safe-area-inset-bottom)+5rem)] mx-auto my-0 max-h-[60svh] w-auto max-w-2xl overflow-y-auto rounded-2xl border border-border/60 bg-bg-card/65 p-2 text-text-primary shadow-[0_4px_24px_-12px_rgb(0_0_0/0.18),inset_0_1px_0_0_rgb(255_255_255/0.3)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
        >
          <nav aria-label={t("more")} className="grid grid-cols-2 gap-1">
            {mobileLinks.slice(4).map(({ href, label, Icon, exact }) => (
              <Link
                key={href}
                href={href}
                aria-current={isMobileActive(pathname, href, exact) ? "page" : undefined}
                className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isMobileActive(highlightPath, href, exact) ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-bg-page")}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  onNavigate(href);
                }}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span>{label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <LogOut className="size-5 shrink-0" aria-hidden />
              <span>{t("signOut")}</span>
            </button>
          </nav>
        </div>
        <div
          className={cn(
            "relative min-w-0"
          )}
          aria-busy={navigatingTo ? true : undefined}
          aria-live="polite"
        >
          {navigatingTo && (
            <span className="sr-only">{tCommon("loading")}</span>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
