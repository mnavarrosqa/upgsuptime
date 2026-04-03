"use client";

import { useEffect, useState, startTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

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
      <span className="text-sm text-text-muted" aria-hidden>
        <Sun className="h-4 w-4" />
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className="rounded-md text-text-muted hover:bg-bg-page hover:text-text-primary"
      aria-label={dark ? t("switchToLight") : t("switchToDark")}
    >
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
