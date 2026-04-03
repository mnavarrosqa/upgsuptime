"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClass =
  "h-auto min-h-10 w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

export function PasswordForm() {
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const apiErrorMessage = useApiErrorMessage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data));
        return;
      }
      toast.success(tAccount("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
          htmlFor="currentPassword"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          {tAccount("currentPassword")}
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <Label
          htmlFor="newPassword"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          {tAccount("newPassword")}
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-text-muted">{tCommon("atLeast8Chars")}</p>
      </div>
      <div>
        <Label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          {tAccount("confirmNewPassword")}
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <Button
          type="submit"
          disabled={saving}
          variant="default"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? tAccount("saving") : tAccount("changePassword")}
        </Button>
      </div>
    </form>
  );
}
