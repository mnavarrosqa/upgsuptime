"use client";

import { useTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useTranslations } from "next-intl";
import { Bell, BookOpen, CircleHelp, PanelsTopLeft, LogOut, MonitorCheck, Settings2, ShieldCheck, CircleUserRound, UsersRound, ServerCog } from "lucide-react";
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
  const dockRef = useRef<HTMLElement>(null);
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

  const onNavigate = useCallback(
    (href: string) => {
      if (href === pathname) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router]
  );

  useEffect(() => {
    const dock = dockRef.current;
    const selected = dock?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!dock || !selected) return;
    dock.scrollTo({
      left: selected.offsetLeft - (dock.clientWidth - selected.offsetWidth) / 2,
      behavior: "instant",
    });
  }, [pathname]);

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
        <nav ref={dockRef} aria-label={t("mainNav")} className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-xl gap-1 overflow-x-auto overscroll-x-contain snap-x snap-proximity scroll-px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-[2rem] border border-border/50 bg-bg-card p-1.5 shadow-[0_8px_32px_-8px_rgb(0_0_0/0.28),inset_0_1px_0_0_rgb(255_255_255/0.16)] supports-[backdrop-filter:blur(1px)]:bg-bg-card/70 supports-[backdrop-filter:blur(1px)]:backdrop-blur-2xl supports-[backdrop-filter:blur(1px)]:backdrop-saturate-150 md:hidden">
          {mobileLinks.map(({ href, label, Icon, exact }) => {
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
                  "group relative flex size-14 shrink-0 snap-start items-center justify-center rounded-full touch-manipulation transition-colors motion-safe:transition-[color,background-color,box-shadow,transform] motion-safe:duration-200 motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary/12 text-primary shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12)]"
                    : "text-text-muted hover:bg-bg-page/60 hover:text-text-primary"
                )}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  if (href === pathname) return;
                  event.preventDefault();
                  onNavigate(href);
                }}
              >
                <span className="relative flex h-6 w-10 shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-0.5">
                  {pending ? <Spinner size="sm" /> : <Icon className="size-6 shrink-0" strokeWidth={active ? 2 : 1.75} aria-hidden />}
                  {href === "/activity" && unreadCount > 0 && (
                    <span className="absolute right-2 top-0 size-2 rounded-full bg-status-down ring-2 ring-bg-card">
                      <span className="sr-only">{t("unreadIncidents")}</span>
                    </span>
                  )}
                </span>
                <span className="sr-only">{label}</span>
                {active && <span className="absolute bottom-1.5 size-1 rounded-full bg-current" aria-hidden />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            title={t("signOut")}
            className="flex size-14 shrink-0 snap-start items-center justify-center rounded-full touch-manipulation text-text-muted hover:bg-bg-page/60 hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex h-6 items-center"><LogOut className="size-6" strokeWidth={1.75} aria-hidden /></span>
            <span className="sr-only">{t("signOut")}</span>
          </button>
        </nav>
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
