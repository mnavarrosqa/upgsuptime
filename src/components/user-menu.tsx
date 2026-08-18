"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { ChevronDown, User, LogOut, BookOpen, CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type UserMenuProps = {
  email: string;
  name?: string | null;
};

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

function getMenuFocusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>('a[href][role="menuitem"], button[role="menuitem"]'),
  ).filter((el) => !el.hasAttribute("disabled"));
}

export function UserMenu({ email, name }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const hadOpenedRef = useRef(false);
  const t = useTranslations("nav");

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("pointerdown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open) {
      hadOpenedRef.current = true;
      const panel = menuPanelRef.current;
      if (panel) {
        const focusables = getMenuFocusables(panel);
        focusables[0]?.focus();
      }
    } else if (hadOpenedRef.current) {
      hadOpenedRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !menuPanelRef.current) return;
    const panel = menuPanelRef.current;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = getMenuFocusables(panel);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const initials = getInitials(name, email);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("accountMenu")}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
          {initials}
        </span>
      </button>
      {open && (
        <div
          ref={menuPanelRef}
          className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-border/60 bg-bg-card shadow-xl shadow-black/10"
          role="menu"
          aria-label={t("accountActions")}
        >
          <div className="border-b border-border px-3.5 py-3">
            {name && (
              <p className="truncate text-sm font-medium text-text-primary">{name}</p>
            )}
            <p className={`truncate text-xs ${name ? "text-text-muted" : "font-medium text-text-primary"}`}>
              {email}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              <User className="size-4 shrink-0" aria-hidden />
              {t("account")}
            </Link>
            <Link
              href="/help"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              {t("help")}
            </Link>
            <Link
              href="/account#onboarding"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
              onClick={() => setOpen(false)}
            >
              <BookOpen className="size-4 shrink-0" aria-hidden />
              {t("onboardingGuide")}
            </Link>
          </div>
          <div className="border-t border-border">
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="h-auto w-full justify-start gap-2.5 rounded-none border-0 px-3.5 py-2.5 text-left text-[13px] font-normal text-text-muted shadow-none hover:bg-bg-page hover:text-text-primary"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              {t("signOut")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
