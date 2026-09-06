type BrandMarkProps = {
  className?: string;
  size?: number;
  animated?: boolean;
};

/** Orbit geometry is shared with generated icons and native splash images. */
import orbit from "@/lib/brand-orbit.json";

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
      <g className={animated ? "brand-orbit-motion" : undefined}>
        <path d={orbit.path} stroke="currentColor" strokeWidth={orbit.strokeWidth} />
        <circle cx={orbit.dot.cx} cy={orbit.dot.cy} r={orbit.dot.r} fill={orbit.color} />
      </g>
    </svg>
  );
}
