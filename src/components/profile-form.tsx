"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/lib/api-errors";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileFormProps = {
  username: string | null | undefined;
  language: "en" | "es";
};

const inputClass =
  "h-auto min-h-10 w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

export function ProfileForm({ username, language }: ProfileFormProps) {
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const apiErrorMessage = useApiErrorMessage();
  const router = useRouter();
  const { update } = useSession();
  const [value, setValue] = useState(username ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "es">(language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: value.trim() || null,
          language: selectedLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data));
        return;
      }
      toast.success(tAccount("usernameUpdated"));
      await update();
      router.refresh();
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          role="alert"
        >
          {error}
        </div>
      )}
      <div>
        <Label
          htmlFor="username"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          {tCommon("username")}{" "}
          <span className="font-normal text-text-muted">({tCommon("optional")})</span>
        </Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={tCommon("lettersNumbersUnderscores")}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          {tAccount("usernameHelp")}
        </p>
      </div>
      <LanguageSelect value={selectedLanguage} onChange={setSelectedLanguage} disabled={saving} id="language-profile" />
      <div>
        <Button
          type="submit"
          disabled={saving}
          variant="default"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? tAccount("saving") : tAccount("saveUsername")}
        </Button>
      </div>
    </form>
  );
}
