import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { UserMenu } from "@/components/user-menu";
import { AppNavLinks } from "@/components/app-nav-links";
import { MobileMenu } from "@/components/mobile-menu";
import { IncidentPoller } from "@/components/incident-poller";
import { ActivityProvider } from "@/components/activity-context";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { BackToTopButton } from "@/components/back-to-top";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { FloatingHelpLink } from "@/components/floating-help-link";

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
      <Link
        href="#main-content"
        className="fixed left-4 top-0 z-[60] -translate-y-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm font-medium text-text-primary shadow-md outline-none ring-2 ring-ring/30 motion-safe:transition-transform focus:left-4 focus:top-4 focus:translate-y-0 focus-visible:left-4 focus-visible:top-4 focus-visible:translate-y-0"
      >
        {t("skipToContent")}
      </Link>
      <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-text-primary transition-opacity hover:opacity-80"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="hidden min-[480px]:inline">{t("appTitle")}</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:gap-1">
              <AppNavLinks role={session.user.role} />
              <div className="ml-auto flex items-center gap-0.5">
                <LanguageToggle />
                <ThemeToggle />
                <span className="mx-1 h-5 w-px bg-border/60" aria-hidden />
                <UserMenu
                  email={session.user.email ?? ""}
                  name={session.user.name ?? null}
                />
              </div>
            </div>

            {/* Mobile: centered title + hamburger */}
            <span
              className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-text-primary sm:hidden"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("appTitle")}
            </span>
            <div className="flex items-center sm:hidden">
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
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
      <FloatingHelpLink />
      <BackToTopButton />
      <PwaInstallBanner />
      <IncidentPoller />
    </div>
    </ActivityProvider>
  );
}
