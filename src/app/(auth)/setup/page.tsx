"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, HeartPulse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSelect } from "@/components/language-select";
import { useApiErrorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authInputClass =
  "h-auto min-h-10 w-full rounded-lg border border-input-border bg-bg-page px-3.5 py-2.5 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-2 focus-visible:ring-input-focus/20";

export default function SetupPage() {
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
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
  const [language, setLanguage] = useState<"en" | "es">((locale === "es" ? "es" : "en"));

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
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data));
        return;
      }
      router.replace("/login");
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  if (loading || needsSetup === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">{tAuth("checkingSetupStatus")}</p>
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
          <HeartPulse size={22} strokeWidth={2.5} />
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {tAuth("createAdminTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {tAuth("createAdminSubtitle")}
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
            <Label htmlFor="email" className="text-sm font-medium text-text-primary">
              {tCommon("email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className={authInputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-sm font-medium text-text-primary">
              {tCommon("username")}{" "}
              <span className="font-normal text-text-muted">({tCommon("optional")})</span>
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tCommon("lettersNumbersUnderscores")}
              className={authInputClass}
            />
            <p className="text-xs text-text-muted">{tAuth("usernameSigninHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-text-primary">
              {tCommon("password")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
            <p className="text-xs text-text-muted">{tCommon("atLeast8Chars")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">
              {tCommon("confirmPassword")}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={cn(
                  authInputClass,
                  "pr-10",
                  passwordMismatch &&
                    "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/20"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                tabIndex={-1}
                size="icon-xs"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 size-8 min-h-0 -translate-y-1/2 rounded-md p-0 text-text-muted shadow-none hover:bg-transparent hover:text-text-primary"
                aria-label={showConfirm ? tCommon("hidePassword") : tCommon("showPassword")}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            {passwordMismatch && (
              <p className="text-xs text-red-600 dark:text-red-400">{tAuth("passwordsDontMatch")}</p>
            )}
          </div>

          <LanguageSelect value={language} onChange={setLanguage} disabled={submitting} id="language-setup" />

          <Button
            type="submit"
            disabled={submitting || passwordMismatch}
            variant="default"
            className="mt-1 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-page transition-opacity hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? tAuth("creatingAccount") : tAuth("createAdminTitle")}
          </Button>
        </form>
      </div>

      {/* Footer link */}
      <div className="mt-5 text-center text-sm text-text-muted">
        <Link href="/login" className="hover:text-text-primary transition-colors">
          {tAuth("alreadyHaveAccount")}{" "}
          <span className="font-medium text-text-primary">{tCommon("signIn")}</span>
        </Link>
      </div>
    </div>
  );
}
