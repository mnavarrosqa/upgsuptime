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
    <Button
      type="button"
      variant="ghost"
      onClick={toggle}
      disabled={switching}
      className="h-auto gap-1 rounded-md px-2 py-2 text-text-muted hover:bg-bg-page hover:text-text-primary"
      aria-label={t("switchLanguage")}
    >
      <Globe className="h-4 w-4" aria-hidden />
      <span className="text-xs font-medium uppercase">{locale}</span>
    </Button>
  );
}
