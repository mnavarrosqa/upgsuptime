import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
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
      <div className="min-h-svh bg-bg-page text-text-primary">
        <Link
          href="#main-content"
          className="fixed left-4 top-0 z-[60] -translate-y-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm font-medium text-text-primary shadow-md outline-none ring-2 ring-ring/30 motion-safe:transition-transform focus:left-4 focus:top-4 focus:translate-y-0 focus-visible:left-4 focus-visible:top-4 focus-visible:translate-y-0"
        >
          {t("skipToContent")}
        </Link>
        <AppShell
          role={session.user.role}
          email={session.user.email ?? ""}
          name={session.user.name ?? null}
        >
          <PullToRefresh />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
          >
            {children}
          </main>
        </AppShell>
        <FloatingHelpLink />
        <BackToTopButton />
        <PwaInstallBanner />
        <IncidentPoller />
      </div>
    </ActivityProvider>
  );
}
