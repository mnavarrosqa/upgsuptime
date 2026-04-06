"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, HeartPulse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authInputClass =
  "h-auto min-h-10 w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-2 focus-visible:ring-input-focus/20";

function LoadingFallback() {
  const tCommon = useTranslations("common");
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-text-muted">{tCommon("loading")}</p>
    </div>
  );
}

function LoginForm() {
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<"en" | "es">((locale === "es" ? "es" : "en"));

  const expired = searchParams.get("expired") === "1";
  const rateLimited = searchParams.get("error") === "rate_limit";
  const callbackUrlRaw = searchParams.get("callbackUrl");
  const safeCallbackUrl =
    callbackUrlRaw &&
    callbackUrlRaw.startsWith("/") &&
    !callbackUrlRaw.startsWith("//")
      ? callbackUrlRaw
      : null;

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
        setError(tAuth("invalidCredentials"));
        return;
      }
      router.replace(safeCallbackUrl ?? "/dashboard");
      router.refresh();
    } catch {
      setError(tCommon("somethingWentWrong"));
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
          {tAuth("signInTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {tAuth("signInSubtitle")}
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
              {tAuth("tooManyAttempts")}
            </div>
          )}
          {expired && !rateLimited && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              role="alert"
            >
              {tAuth("sessionExpired")}
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
            <Label htmlFor="login" className="text-sm font-medium text-text-primary">
              {tAuth("emailOrUsername")}
            </Label>
            <Input
              id="login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              placeholder="you@example.com"
              className={authInputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-text-primary">
              {tCommon("password")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${authInputClass} pr-10`}
              />
              <Button
                type="button"
                variant="ghost"
                tabIndex={-1}
                size="icon-xs"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 size-8 min-h-0 -translate-y-1/2 rounded-md p-0 text-text-muted shadow-none hover:bg-transparent hover:text-text-primary"
                aria-label={showPassword ? tCommon("hidePassword") : tCommon("showPassword")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            variant="default"
            className="mt-1 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-page transition-opacity hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? tAuth("signingIn") : tCommon("signIn")}
          </Button>
          <LanguageSelect value={language} onChange={setLanguage} disabled={submitting} id="language-login" />
        </form>
      </div>

      {/* Footer links */}
      <div className="mt-5 text-center text-sm text-text-muted">
        {needsSetup === true && (
          <Link href="/setup" className="hover:text-text-primary transition-colors">
            {tAuth("firstTimeSetup")}
          </Link>
        )}
        {needsSetup === false && (
          <Link href="/register" className="hover:text-text-primary transition-colors">
            {tAuth("noAccount")}{" "}
            <span className="font-medium text-text-primary">{tAuth("registerCta")}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}
