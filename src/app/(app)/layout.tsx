import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeartPulse } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { UserMenu } from "@/components/user-menu";
import { AppNavLinks } from "@/components/app-nav-links";
import { MobileMenu } from "@/components/mobile-menu";
import { IncidentPoller } from "@/components/incident-poller";
import { ActivityProvider } from "@/components/activity-context";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { BackToTopButton } from "@/components/back-to-top";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const t = await getTranslations("nav");

  return (
    <ActivityProvider>
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-stretch gap-2 sm:gap-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-primary hover:text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <HeartPulse className="size-4 shrink-0" />
              {t("appTitle")}
            </Link>

            {/* Desktop nav */}
            <span className="my-3 hidden w-px bg-border sm:block" aria-hidden />
            <div className="hidden sm:flex sm:flex-1 sm:items-stretch">
              <AppNavLinks role={session.user.role} />
              <div className="ml-auto flex items-center gap-1">
                <LanguageToggle />
                <ThemeToggle />
                <span className="h-4 w-px bg-border" aria-hidden />
                <UserMenu
                  email={session.user.email ?? ""}
                  name={session.user.name ?? null}
                />
              </div>
            </div>

            {/* Mobile hamburger */}
            <div className="ml-auto flex items-center sm:hidden">
              <MobileMenu
                role={session.user.role}
                email={session.user.email ?? ""}
                name={session.user.name ?? null}
              />
            </div>
          </div>
        </div>
      </header>
      <PullToRefresh />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <BackToTopButton />
      <IncidentPoller />
    </div>
    </ActivityProvider>
  );
}
