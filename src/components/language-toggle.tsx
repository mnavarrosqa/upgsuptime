"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("locale");
  const [switching, setSwitching] = useState(false);

  async function toggle() {
    const next = locale === "en" ? "es" : "en";
    setSwitching(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={switching}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary disabled:opacity-50"
      aria-label={t("switchLanguage")}
    >
      <Globe className="size-3.5" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-wide">{locale}</span>
    </button>
  );
}
