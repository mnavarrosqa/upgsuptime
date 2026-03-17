"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle } from "lucide-react";

type ProfileFormProps = {
  username: string | null | undefined;
};

const inputClass =
  "w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus";

export function ProfileForm({ username }: ProfileFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [value, setValue] = useState(username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setSuccess(true);
      await update();
      router.refresh();
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
          Username updated
        </div>
      )}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          Username{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSuccess(false);
          }}
          placeholder="Letters, numbers, underscores"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          2+ characters. Used to sign in instead of email.
        </p>
      </div>
      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save username"}
        </button>
      </div>
    </form>
  );
}
