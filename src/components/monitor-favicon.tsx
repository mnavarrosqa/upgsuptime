"use client";

import { useState } from "react";

const sizeClass = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

export function MonitorFavicon({
  src,
  size = "sm",
}: {
  src: string;
  size?: keyof typeof sizeClass;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={`${sizeClass[size]} shrink-0 rounded bg-border`}
        aria-hidden
      />
    );
  }
  const dim = size === "md" ? 24 : 16;
  return (
    <img
      src={src}
      alt=""
      className={`${sizeClass[size]} shrink-0 rounded`}
      width={dim}
      height={dim}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
