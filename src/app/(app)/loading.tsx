"use client";

import { BrandLoading } from "@/components/brand-loading";

import { useTranslations } from "next-intl";

export default function AppLoading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-8">
      <BrandLoading label={t("loading")} />
      <div aria-hidden="true" className="space-y-3">
        <div className="h-8 w-2/3 max-w-sm rounded-md bg-border/60 motion-safe:animate-[shimmer_1.8s_ease-in-out_infinite]" />
        <div className="h-4 w-1/2 max-w-xs rounded bg-border/40 motion-safe:animate-[shimmer_1.8s_ease-in-out_0.2s_infinite]" />
      </div>
      <div aria-hidden="true" className="divide-y divide-border/60">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 py-6 motion-safe:animate-[fade-slide-up_0.5s_ease-out_both]"
            style={{ animationDelay: `${0.1 + row * 0.08}s` }}
          >
            <div className="size-8 shrink-0 rounded-md bg-border/50 motion-safe:animate-[shimmer_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${row * 0.15}s` }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 max-w-xs rounded bg-border/50 motion-safe:animate-[shimmer_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${row * 0.15 + 0.05}s` }} />
              <div className="h-3 w-1/3 rounded bg-border/30 motion-safe:animate-[shimmer_1.8s_ease-in-out_infinite]" style={{ animationDelay: `${row * 0.15 + 0.1}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
