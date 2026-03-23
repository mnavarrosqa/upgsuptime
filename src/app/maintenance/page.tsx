import type { Metadata } from "next";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "Maintenance — UPG Monitor",
  description: "UPG Monitor is temporarily down for maintenance.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-bg-page text-text-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-bg-page">
            <Activity size={26} strokeWidth={2.5} aria-hidden />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted font-display">
            UPG Monitor
          </p>
        </div>

        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-text-primary font-display">
          Down for maintenance
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-text-muted">
          We&rsquo;re performing scheduled maintenance and will be back shortly.
          <br />
          Thank you for your patience.
        </p>

        {/* Status card */}
        <div className="rounded-2xl border border-border bg-bg-card px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <div>
              <p className="text-sm font-medium text-text-primary">Maintenance in progress</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Monitor checks are paused. Your uptime data is safe.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-text-muted">
          <a
            href="/"
            className="font-medium text-text-primary underline-offset-4 hover:underline transition-colors"
          >
            Try again
          </a>
        </p>
      </div>
    </div>
  );
}
