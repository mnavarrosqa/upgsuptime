"use client";

import { Loader2 } from "lucide-react";

export function Spinner({
  size = "default",
  className = "",
}: {
  size?: "sm" | "default";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <Loader2
      className={`animate-spin text-text-muted ${sizeClass} shrink-0 ${className}`}
      aria-hidden
    />
  );
}
