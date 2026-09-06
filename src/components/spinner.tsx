"use client";

import { BrandMark } from "@/components/brand-mark";

export function Spinner({
  size = "default",
  className = "",
}: {
  size?: "sm" | "default";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <BrandMark
      className={`text-text-muted ${sizeClass} shrink-0 ${className}`}
      animated
    />
  );
}
