import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { AppNavLinks } from "@/components/app-nav-links";
import { IncidentPoller } from "@/components/incident-poller";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-stretch gap-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center text-sm font-semibold text-text-primary hover:text-text-muted"
              style={{ fontFamily: "var(--font-display)" }}
            >
              UPGS Monitor
            </Link>
            <span className="my-3 w-px bg-border" aria-hidden />
            <AppNavLinks />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <span className="h-4 w-px bg-border" aria-hidden />
              <UserMenu
                email={session.user.email ?? ""}
                name={session.user.name ?? null}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <IncidentPoller />
    </div>
  );
}
