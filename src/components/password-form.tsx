"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change password");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Something went wrong");
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
      {success && (
        <div
          className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
          role="status"
        >
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          Password changed successfully
        </div>
      )}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setSuccess(false);
          }}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setSuccess(false);
          }}
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-text-muted">At least 8 characters</p>
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setSuccess(false);
          }}
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
          {saving ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
