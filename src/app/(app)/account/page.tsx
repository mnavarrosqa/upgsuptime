import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Mail, Shield, User } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { PasswordForm } from "@/components/password-form";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AccountOnboardingSection } from "@/components/account-onboarding-section";
import { AccountDataPortability } from "@/components/account-data-portability";
import { ApiAccessSection } from "@/components/api-access-section";
import { AccountTabs } from "@/components/account-tabs";
import { getTranslations } from "next-intl/server";

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function AccountPage() {
  const [session, tAccount, tCommon] = await Promise.all([
    getServerSession(authOptions),
    getTranslations("account"),
    getTranslations("common"),
  ]);
  if (!session?.user) redirect("/login");

  const { email, name, role, id } = session.user;
  const initials = getInitials(name, email ?? "");

  const [userOnboarding] = await db
    .select({ onboardingCompleted: user.onboardingCompleted, onboardingStep: user.onboardingStep, language: user.language })
    .from(user)
    .where(eq(user.id, id));

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="text-2xl font-semibold tracking-tight text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {tAccount("title")}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        {tAccount("subtitle")}
      </p>

      <AccountTabs
        profile={
          <>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-bg-card px-6 py-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg-card">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">
                  {name ?? email}
                </p>
                {name && (
                  <p className="truncate text-sm text-text-muted">{email}</p>
                )}
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    role === "admin"
                      ? "bg-accent text-bg-card"
                      : "border border-border text-text-muted"
                  }`}
                >
                  <Shield className="h-3 w-3" aria-hidden />
                  {role ?? "user"}
                </span>
              </div>
            </div>

            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-card">
              <div className="flex items-center gap-3 px-6 py-4">
                <User className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {tCommon("username")}
                  </p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {name ?? <span className="italic text-text-muted">{tAccount("notSet")}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <Mail className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {tCommon("email")}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-text-primary">
                    {email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <Shield className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {tAccount("role")}
                  </p>
                  <p className="mt-0.5 capitalize text-sm text-text-primary">
                    {role ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h2
                className="text-base font-semibold text-text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tAccount("profileTitle")}
              </h2>
              <p className="mt-0.5 text-sm text-text-muted">
                {tAccount("profileSubtitle")}
              </p>
              <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
                <ProfileForm username={name} language={userOnboarding?.language ?? "en"} />
              </div>
            </div>

            <AccountDataPortability />
          </>
        }
        security={
          <div>
            <h2
              className="text-base font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tAccount("securityTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">
              {tAccount("securitySubtitle")}
            </p>
            <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
              <PasswordForm />
            </div>
          </div>
        }
        guide={
          <AccountOnboardingSection
            onboardingCompleted={userOnboarding?.onboardingCompleted}
            userId={id}
            className="mt-0"
          />
        }
        developer={<ApiAccessSection username={name} className="mt-0" />}
      />
    </div>
  );
}
