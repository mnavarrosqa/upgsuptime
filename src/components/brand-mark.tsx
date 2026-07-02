type BrandMarkProps = {
  className?: string;
  /** Explicit pixel size (sets width/height). Omit to size via className. */
  size?: number;
  strokeWidth?: number;
};

/**
 * UPG Monitor brand mark: an uptime pulse line (currentColor) resolving into an
 * emerald "operational" status dot. Mirrors the app icon in src/app/icon.svg.
 * Decorative — always paired with the wordmark, so it's aria-hidden.
 */
export function BrandMark({ className, size, strokeWidth = 2.6 }: BrandMarkProps) {
  return (
    <svg
      viewBox="2.5 3.5 26 26"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 17 H10.2 L13.2 20.6 L15.2 6.6 L17.2 24 L18.9 17 H21.6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.6" cy="17" r="2.4" fill="#10b981" />
    </svg>
  );
}
