"use client";

import { BrandLoading } from "@/components/brand-loading";

import { useTranslations } from "next-intl";

/** Shared, lightweight fallback keeps navigation available while route data streams. */
export default function AppLoading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-8">
      <BrandLoading label={t("loading")} />
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-8 w-2/3 max-w-sm rounded-md bg-border/60" />
        <div className="h-4 w-1/2 max-w-xs rounded bg-border/40" />
      </div>
      <div aria-hidden="true" className="divide-y divide-border/60 motion-safe:animate-pulse">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4 py-6">
            <div className="size-8 shrink-0 rounded-md bg-border/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 max-w-xs rounded bg-border/50" />
              <div className="h-3 w-1/3 rounded bg-border/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
