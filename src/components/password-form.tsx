"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/lib/api-errors";

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

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
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {tAccount("currentPassword")}
        </label>
        <input
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
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {tAccount("newPassword")}
        </label>
        <input
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
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {tAccount("confirmNewPassword")}
        </label>
        <input
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
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? tAccount("saving") : tAccount("changePassword")}
        </button>
      </div>
    </form>
  );
}
