"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { ChevronDown, User, LogOut, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";

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

export function UserMenu({ email, name }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("nav");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const initials = getInitials(name, email);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-muted hover:bg-bg-page hover:text-text-primary"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("accountMenu")}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg-page">
          {initials}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-border bg-bg-card py-1 shadow-lg"
          role="menu"
          aria-label={t("accountActions")}
        >
          <div className="border-b border-border px-3 py-2.5">
            {name && (
              <p className="truncate text-sm font-medium text-text-primary">{name}</p>
            )}
            <p className={`truncate text-xs ${name ? "text-text-muted" : "font-medium text-text-primary"}`}>
              {email}
            </p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-page hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("account")}
          </Link>
          <Link
            href="/account#onboarding"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-page hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("onboardingGuide")}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-page hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
