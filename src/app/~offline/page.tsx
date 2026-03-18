import type { Metadata } from "next";
import { HeartPulse, WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "You're offline — UPGS Monitor",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--bg-page)]">
            <HeartPulse size={26} strokeWidth={2.5} aria-hidden />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] font-display">
            UPGS Monitor
          </p>
        </div>

        <div className="mb-6 flex justify-center">
          <WifiOff className="size-8 text-[var(--text-muted)]" aria-hidden />
        </div>

        <h1 className="mb-3 text-2xl font-semibold tracking-tight font-display">
          You&apos;re offline
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[var(--text-muted)]">
          UPGS Monitor needs a live connection to show uptime data.
          <br />
          Check your network and try again.
        </p>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="relative mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-[var(--text-muted)]" />
            <div>
              <p className="text-sm font-medium">No network connection</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Monitor data cannot be fetched while offline.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-[var(--text-muted)]">
          <a
            href="/dashboard"
            className="font-medium text-[var(--text-primary)] underline-offset-4 hover:underline transition-colors"
          >
            Try again
          </a>
        </p>
      </div>
    </div>
  );
}
