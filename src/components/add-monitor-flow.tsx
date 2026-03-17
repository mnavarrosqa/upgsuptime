"use client";

import { useState } from "react";
import { AddMonitorForm } from "@/components/add-monitor-form";
import { AddBulkMonitorsForm } from "@/components/add-bulk-monitors-form";

type AddMode = "single" | "bulk";

export function AddMonitorFlow({
  onSuccess,
  onCancel,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<AddMode | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Add one site or many at once with the same settings.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode("single")}
          className="rounded-md border border-border bg-bg-page px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-elevated"
        >
          Single site
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className="rounded-md border border-border bg-bg-page px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-elevated"
        >
          Multiple sites
        </button>
      </div>
    </div>
  );
}
