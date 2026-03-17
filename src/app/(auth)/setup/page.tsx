"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data: { needsSetup: boolean }) => {
        setNeedsSetup(data.needsSetup);
        if (!data.needsSetup) {
          router.replace("/login");
        }
      })
      .catch(() => setNeedsSetup(false))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: username.trim() || undefined,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed");
        return;
      }
      router.replace("/login");
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  if (loading || needsSetup === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Checking setup status…</p>
      </div>
    );
  }

  if (!needsSetup) {
    return null;
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-bg-page">
          <ShieldCheck size={22} strokeWidth={2.5} />
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Create admin account
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          First run — create the initial administrator to manage uptime monitors.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-bg-card px-8 py-7 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-2 focus:ring-input-focus/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-text-primary">
              Username{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Letters, numbers, underscores"
              className="w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-2 focus:ring-input-focus/20"
            />
            <p className="text-xs text-text-muted">You can sign in with email or username</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-primary">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-2 focus:ring-input-focus/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-text-muted">At least 8 characters</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full rounded-lg border bg-bg-page px-3.5 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 ${
                  passwordMismatch
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                    : "border-input-border focus:border-input-focus focus:ring-input-focus/20"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordMismatch && (
              <p className="text-xs text-red-600 dark:text-red-400">Passwords don&apos;t match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || passwordMismatch}
            className="mt-1 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60 transition-opacity"
          >
            {submitting ? "Creating account…" : "Create admin account"}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <div className="mt-5 text-center text-sm text-text-muted">
        <Link href="/login" className="hover:text-text-primary transition-colors">
          Already have an account?{" "}
          <span className="font-medium text-text-primary">Sign in</span>
        </Link>
      </div>
    </div>
  );
}
