"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("nav");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerId = useId();
  const [openedAtPath, setOpenedAtPath] = useState(pathname);
  const visible = open && pathname === openedAtPath;

  const close = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);

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
          "flex flex-col border-r border-border/60 bg-bg-card max-md:safe-top",
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
          onNavigate={() => close()}
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-bg-card/80 backdrop-blur-xl md:hidden">
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
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="truncate">{t("appTitle")}</span>
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
