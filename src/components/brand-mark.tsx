type BrandMarkProps = {
  className?: string;
  size?: number;
  animated?: boolean;
};

import pulse from "@/lib/brand-orbit.json";

export function BrandMark({ className, size, animated = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={pulse.path}
        stroke="currentColor"
        strokeWidth={pulse.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pulse.dot.cx} cy={pulse.dot.cy} r={pulse.dot.r} fill={pulse.color}>
        {animated && (
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
}
