"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  value: "en" | "es";
  onChange: (value: "en" | "es") => void;
  disabled?: boolean;
  id?: string;
};

export function LanguageSelect({ value, onChange, disabled, id = "language" }: Props) {
  const t = useTranslations("locale");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(nextValue: "en" | "es") {
    onChange(nextValue);
    setSaving(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextValue }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {t("label")}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled || saving}
        onChange={(e) => handleChange(e.target.value as "en" | "es")}
        className="w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary focus:border-input-focus focus:outline-none focus:ring-2 focus:ring-input-focus/20"
      >
        <option value="en">{t("english")}</option>
        <option value="es">{t("spanish")}</option>
      </select>
    </div>
  );
}
