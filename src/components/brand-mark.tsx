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
        {...(animated && {
          strokeDasharray: 60,
          strokeDashoffset: 60,
        })}
      >
        {animated && (
          <animate
            attributeName="stroke-dashoffset"
            values="60;0;0;60"
            keyTimes="0;0.4;0.7;1"
            dur="2.4s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <circle cx={pulse.dot.cx} cy={pulse.dot.cy} r={pulse.dot.r} fill={pulse.color}>
        {animated && (
          <>
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.35;0.45;0.7;1" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="r" values="0;2.2;3;2.2;0" keyTimes="0;0.35;0.5;0.7;1" dur="2.4s" repeatCount="indefinite" />
          </>
        )}
      </circle>
    </svg>
  );
}
