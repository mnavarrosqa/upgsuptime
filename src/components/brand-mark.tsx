type BrandMarkProps = {
  className?: string;
  /** Explicit pixel size (sets width/height). Omit to size via className. */
  size?: number;
  strokeWidth?: number;
};

/** Keep in sync with `src/app/icon.svg` and `scripts/generate-pwa-splash.mjs`. */
export const BRAND_MARK_PULSE_PATH = "M6 16.5 H11 L14.2 9.4 L19.2 16.5 H21.2";
export const BRAND_MARK_DOT = { cx: 24.6, cy: 16.5, r: 2.2, haloR: 3.55 };

/**
 * UPG Monitor brand mark: one uptime spike resolving into a live operational
 * dot. Geometry matches the app icon. Decorative — always paired with the
 * wordmark, so it's aria-hidden.
 */
export function BrandMark({ className, size, strokeWidth = 2.25 }: BrandMarkProps) {
  const { cx, cy, r, haloR } = BRAND_MARK_DOT;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={BRAND_MARK_PULSE_PATH}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={haloR} fill="var(--status-up)" opacity="0.22" />
      <circle cx={cx} cy={cy} r={r} fill="var(--status-up)" />
    </svg>
  );
}
