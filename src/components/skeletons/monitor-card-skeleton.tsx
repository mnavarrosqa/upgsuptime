export function MonitorCardSkeleton() {
  return (
    <li className="h-[188px] rounded-lg border border-border bg-bg-card p-4">
      <div className="flex h-full gap-4">
        {/* Favicon placeholder */}
        <div className="shrink-0">
          <div className="h-4 w-4 animate-shimmer rounded" aria-hidden />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Name placeholder */}
          <div className="h-5 w-3/4 animate-shimmer rounded-sm" aria-hidden />

          {/* URL placeholder */}
          <div className="h-3 w-1/2 animate-shimmer rounded-sm" aria-hidden />

          {/* Status badges placeholders */}
          <div className="mt-auto flex items-center gap-2">
            <div className="h-6 w-16 animate-shimmer rounded-full" aria-hidden />
            <div className="h-6 w-16 animate-shimmer rounded-full" aria-hidden />
            <div className="h-6 w-10 animate-shimmer rounded-full" aria-hidden />
          </div>

          {/* Trend chart placeholder */}
          <div className="mt-3 h-8 w-full animate-shimmer rounded-sm" aria-hidden />
        </div>
      </div>

      <style>{`
        .animate-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            hsl(var(--border) / 0.1) 20%,
            transparent 40%,
            hsl(var(--border) / 0.1) 60%,
            transparent 80%,
            hsl(var(--border) / 0.1) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-shimmer {
            animation: none;
          }
        }
      `}</style>
    </li>
  );
}
