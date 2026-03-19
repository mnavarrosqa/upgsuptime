export function StatSkeleton() {
  return (
    <>
      <span className="inline-flex items-center gap-1">
        <div className="h-5 w-8 animate-shimmer rounded" aria-hidden />
        <div className="h-5 w-16 animate-shimmer rounded-sm" aria-hidden />
        <div className="h-5 w-8 animate-shimmer rounded" aria-hidden />
      </span>

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
    </>
  );
}
