"use client";

import { useTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, LayoutDashboard, Menu, Monitor, X } from "lucide-react";
import { useActivity } from "@/components/activity-context";
import { Spinner } from "@/components/spinner";
import { BrandMark } from "@/components/brand-mark";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";
import { hrefPath, isPrimaryNavActive, APP_PRIMARY_NAV_LINKS } from "@/lib/app-main-nav";

const MOBILE_NAV_ICONS = {
  "/dashboard": LayoutDashboard,
  "/monitors": Monitor,
  "/activity": Bell,
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
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerId = useId();
  const [openedAtPath, setOpenedAtPath] = useState(pathname);
  const visible = open && pathname === openedAtPath;
  const navigatingTo =
    isPending && pendingHref ? pendingHref : null;
  const highlightPath = navigatingTo ? hrefPath(navigatingTo) : pathname;

  const close = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);

  const onNavigate = useCallback(
    (href: string) => {
      close();
      if (hrefPath(href) === pathname) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router, close]
  );

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close({ restoreFocus: true });
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
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
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const firstItem = drawerRef.current?.querySelector<HTMLElement>(
        "a[href], button:not([disabled])"
      );
      firstItem?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close, visible]);

  return (
    <div className="min-h-svh bg-bg-page text-text-primary md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        aria-label={t("closeMenu")}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 md:hidden motion-safe:transition-opacity motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)]",
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => close()}
      />
      <aside
        id={drawerId}
        ref={drawerRef}
        role={visible ? "dialog" : undefined}
        aria-modal={visible ? true : undefined}
        aria-label={t("navMenu")}
        className={cn(
          "flex flex-col border-r border-border/60 bg-bg-card max-md:safe-top max-md:pb-[env(safe-area-inset-bottom)]",
          "fixed inset-y-0 left-0 z-50 w-60 max-w-[min(100vw-3rem,16rem)] shadow-xl",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:[transition-timing-function:var(--motion-ease-out-quart)]",
          "md:static md:z-auto md:h-svh md:w-auto md:max-w-none md:translate-x-0 md:shadow-none",
          visible ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          !visible && "max-md:invisible max-md:pointer-events-none"
        )}
      >
        <AppSidebar
          role={role}
          email={email}
          name={name}
          activePath={highlightPath}
          pending={Boolean(navigatingTo)}
          onClose={() => close()}
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
          <div className="flex h-14 items-center gap-2 px-3">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => {
                if (visible) {
                  setOpen(false);
                } else {
                  setOpenedAtPath(pathname);
                  setOpen(true);
                }
              }}
              className="flex size-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
              aria-label={visible ? t("closeMenu") : t("openMenu")}
              aria-expanded={visible}
              aria-controls={drawerId}
            >
              {visible ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
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
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="truncate">{t("appTitle")}</span>
            </Link>
          </div>
        </header>
        <nav aria-label={t("mainNav")} className="fixed inset-x-0 bottom-0 z-30 grid h-[var(--mobile-nav-height)] grid-cols-3 gap-1 border-t border-border/60 bg-bg-card px-3 pt-1 pb-[env(safe-area-inset-bottom)] md:hidden">
          {APP_PRIMARY_NAV_LINKS.map(({ href, labelKey }) => {
            const Icon = MOBILE_NAV_ICONS[href];
            const active = isPrimaryNavActive(highlightPath, href);
            const pending = navigatingTo === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isPrimaryNavActive(pathname, href) ? "page" : undefined}
                aria-busy={pending || undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium touch-manipulation transition-colors motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "text-primary"
                    : "text-text-muted hover:bg-bg-page hover:text-text-primary"
                )}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  if (href === pathname) return;
                  event.preventDefault();
                  onNavigate(href);
                }}
              >
                <span className={cn(
                  "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                  active && "bg-primary/10"
                )}>
                  {pending ? <Spinner size="sm" /> : <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />}
                  {href === "/activity" && unreadCount > 0 && (
                    <span className="absolute right-2 top-0 size-2 rounded-full bg-status-down ring-2 ring-bg-card">
                      <span className="sr-only">{t("unreadIncidents")}</span>
                    </span>
                  )}
                </span>
                <span>{t(labelKey)}</span>
              </Link>
            );
          })}
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
