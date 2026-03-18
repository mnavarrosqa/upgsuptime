"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, HeartPulse } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  const expired = searchParams.get("expired") === "1";
  const rateLimited = searchParams.get("error") === "rate_limit";

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data: { needsSetup: boolean }) => setNeedsSetup(data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        login: login.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email, username, or password");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-bg-page">
          <HeartPulse size={22} strokeWidth={2.5} />
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Sign in
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Use your admin or user account to manage monitors.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-bg-card px-8 py-7 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {rateLimited && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              role="alert"
            >
              Too many sign-in attempts. Try again in 15 minutes.
            </div>
          )}
          {expired && !rateLimited && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              role="alert"
            >
              Your session expired. Please sign in again.
            </div>
          )}
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login" className="text-sm font-medium text-text-primary">
              Email or username
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-2 focus:ring-input-focus/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-primary">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60 transition-opacity"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      {/* Footer links */}
      <div className="mt-5 text-center text-sm text-text-muted">
        {needsSetup === true && (
          <Link href="/setup" className="hover:text-text-primary transition-colors">
            First time? Create admin account →
          </Link>
        )}
        {needsSetup === false && (
          <Link href="/register" className="hover:text-text-primary transition-colors">
            Don&apos;t have an account?{" "}
            <span className="font-medium text-text-primary">Register</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
