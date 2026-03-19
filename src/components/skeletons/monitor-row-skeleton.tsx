export function MonitorRowSkeleton() {
  return (
    <>
      <tr>
        {/* Monitor cell */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 animate-shimmer rounded" aria-hidden />
            <div className="h-4 w-32 animate-shimmer rounded-sm" aria-hidden />
          </div>
        </td>

        {/* URL cell */}
        <td className="hidden max-w-[14rem] animate-shimmer px-4 py-3 h-11 sm:table-cell" aria-hidden />

        {/* Status cell */}
        <td className="px-4 py-3">
          <div className="h-6 w-16 animate-shimmer rounded-full" aria-hidden />
        </td>

        {/* SSL cell */}
        <td className="hidden px-4 py-3 sm:table-cell">
          <div className="h-6 w-20 animate-shimmer rounded" aria-hidden />
        </td>

        {/* Last checked cell */}
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="h-4 w-24 animate-shimmer rounded-sm" aria-hidden />
        </td>

        {/* Interval cell */}
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="h-4 w-16 animate-shimmer rounded-sm" aria-hidden />
        </td>

        {/* Actions cell */}
        <td className="px-4 py-3 text-right">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md animate-shimmer" aria-hidden />
        </td>
      </tr>

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
