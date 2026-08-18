"use client";

import { useEffect, useState, startTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("theme");

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
      const isDark =
        document.documentElement.classList.contains("dark") ||
        (!localStorage.getItem(STORAGE_KEY) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDark(isDark);
    });
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    setDark(next);
  }

  if (!mounted) {
    return (
      <span className="flex size-8 items-center justify-center text-text-muted" aria-hidden>
        <Sun className="size-3.5" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary"
      aria-label={dark ? t("switchToLight") : t("switchToDark")}
    >
      <span className="relative size-4">
        <Sun
          className={`absolute inset-0 size-4 transition-[opacity,transform] duration-200 [transition-timing-function:var(--motion-ease-out-quart)] ${dark ? "opacity-100 motion-safe:animate-icon-swap-in" : "pointer-events-none rotate-12 scale-90 opacity-0"}`}
          aria-hidden
        />
        <Moon
          className={`absolute inset-0 size-4 transition-[opacity,transform] duration-200 [transition-timing-function:var(--motion-ease-out-quart)] ${dark ? "pointer-events-none -rotate-12 scale-90 opacity-0" : "opacity-100 motion-safe:animate-icon-swap-in"}`}
          aria-hidden
        />
      </span>
    </button>
  );
}
