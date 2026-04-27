"use client";

import { useState } from "react";
import { Layers3, PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { AddMonitorForm } from "@/components/add-monitor-form";
import { AddBulkMonitorsForm } from "@/components/add-bulk-monitors-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddMode = "single" | "bulk";

export function AddMonitorFlow({
  onSuccess,
  onCancel,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<AddMode | null>(null);
  const t = useTranslations("addMonitorFlow");

  if (mode === "single") {
    return (
      <AddMonitorForm
        onSuccess={onSuccess}
        onCancel={onCancel}
        onBack={() => setMode(null)}
      />
    );
  }

  if (mode === "bulk") {
    return (
      <AddBulkMonitorsForm
        onSuccess={onSuccess}
        onCancel={onCancel}
        onBack={() => setMode(null)}
      />
    );
  }

  const choices = [
    {
      mode: "single" as const,
      title: t("singleTitle"),
      description: t("singleDescription"),
      meta: t("singleMeta"),
      badge: t("recommended"),
      icon: PlusCircle,
    },
    {
      mode: "bulk" as const,
      title: t("bulkTitle"),
      description: t("bulkDescription"),
      meta: t("bulkMeta"),
      badge: undefined,
      icon: Layers3,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="max-w-xl">
        <p className="text-sm leading-6 text-text-muted">
          {t("intro")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const Icon = choice.icon;
          return (
            <Button
              key={choice.mode}
              type="button"
              onClick={() => setMode(choice.mode)}
              variant="outline"
              className={cn(
                "group h-auto rounded-xl border-border bg-bg-page p-0 text-left text-text-primary hover:bg-bg-card",
                "focus-visible:ring-3 focus-visible:ring-ring/30"
              )}
            >
              <span className="flex h-full w-full flex-col items-start gap-4 p-4">
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="rounded-full border border-border bg-bg-card p-2 text-text-muted transition-colors group-hover:text-text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {choice.badge && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {choice.badge}
                    </span>
                  )}
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-semibold">
                    {choice.title}
                  </span>
                  <span className="block whitespace-normal text-sm font-normal leading-5 text-text-muted">
                    {choice.description}
                  </span>
                </span>
                <span className="mt-auto border-t border-border pt-3 text-xs font-medium text-text-muted">
                  {choice.meta}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
