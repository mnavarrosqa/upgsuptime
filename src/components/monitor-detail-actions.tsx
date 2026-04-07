"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Monitor } from "@/db/schema";
import { Overlay } from "@/components/overlay";
import { EditMonitorForm } from "@/components/edit-monitor-form";
import { DeleteMonitorButton } from "@/components/delete-monitor-button";
import { CheckNowButton } from "@/components/check-now-button";
import { Button } from "@/components/ui/button";

export function MonitorDetailActions({ monitor }: { monitor: Monitor }) {
  const t = useTranslations("monitorDetail");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pausing, setPausing] = useState(false);

  async function togglePause() {
    setPausing(true);
    try {
      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !monitor.paused }),
      });
      if (res.ok) {
        toast.success(
          monitor.paused ? t("toastMonitorResumed") : t("toastMonitorPaused")
        );
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data.error === "string" ? data.error : t("toastMonitorUpdateFailed")
        );
      }
    } finally {
      setPausing(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!monitor.paused && (
          <CheckNowButton monitorId={monitor.id} variant="primary" />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={togglePause}
          disabled={pausing}
          className="rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-page active:scale-95"
        >
          {pausing
            ? monitor.paused
              ? t("actionResuming")
              : t("actionPausing")
            : monitor.paused
              ? t("actionResume")
              : t("actionPause")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditOpen(true)}
          className="rounded-md border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-page active:scale-95"
        >
          {t("actionEdit")}
        </Button>
        <DeleteMonitorButton
          monitorId={monitor.id}
          monitorName={monitor.name}
        />
      </div>
      <Overlay
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("overlayEditTitle")}
      >
        <EditMonitorForm
          monitor={monitor}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Overlay>
    </>
  );
}
