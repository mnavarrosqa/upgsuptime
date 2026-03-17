import { ShieldCheck, ShieldAlert, ShieldX, ShieldOff } from "lucide-react";

type SslBadgeProps = {
  monitoring: boolean;
  valid: boolean | null;
  expiresAt: Date | string | null;
  /** compact = icon only with days count, for use inside monitor cards */
  compact?: boolean;
};

function getDaysUntilExpiry(expiresAt: Date | string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

export function SslBadge({ monitoring, valid, expiresAt, compact = false }: SslBadgeProps) {
  if (!monitoring) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-border px-2 py-0.5 text-xs font-medium text-text-muted">
        <ShieldOff className="h-3 w-3" aria-hidden />
        SSL —
      </span>
    );
  }

  const days = getDaysUntilExpiry(expiresAt);

  // Not yet checked
  if (valid === null) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 rounded-full bg-border px-2 py-0.5 text-xs font-medium text-text-muted">
        <ShieldOff className="h-3 w-3" aria-hidden />
        SSL —
      </span>
    );
  }

  // Invalid cert
  if (!valid) {
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
          title="SSL certificate invalid"
        >
          <ShieldX className="h-3.5 w-3.5" aria-hidden />
          SSL ✗
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-red-900/40 dark:text-red-400">
        <ShieldX className="h-3 w-3" aria-hidden />
        SSL Invalid
      </span>
    );
  }

  // Valid cert — check expiry
  if (days !== null && days <= 7) {
    // Critical — expiring very soon
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
          title={`SSL expires in ${days} day${days !== 1 ? "s" : ""}`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-red-900/40 dark:text-red-400">
        <ShieldAlert className="h-3 w-3" aria-hidden />
        SSL {days}d left
      </span>
    );
  }

  if (days !== null && days <= 30) {
    // Warning — expiring soon
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400"
          title={`SSL expires in ${days} days`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium text-white dark:bg-yellow-900/40 dark:text-yellow-400">
        <ShieldAlert className="h-3 w-3" aria-hidden />
        SSL {days}d left
      </span>
    );
  }

  // Healthy
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
        title={days !== null ? `SSL valid — ${days} days left` : "SSL valid"}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        {days !== null ? `${days}d` : "✓"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-emerald-900/40 dark:text-emerald-400">
      <ShieldCheck className="h-3 w-3" aria-hidden />
      SSL {days !== null ? `${days}d` : "Valid"}
    </span>
  );
}
