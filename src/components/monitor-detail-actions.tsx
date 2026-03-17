"use client";

import { useState } from "react";
import Link from "next/link";
import type { Monitor } from "@/db/schema";
import { Overlay } from "@/components/overlay";
import { EditMonitorForm } from "@/components/edit-monitor-form";
import { DeleteMonitorButton } from "@/components/delete-monitor-button";
import { CheckNowButton } from "@/components/check-now-button";

export function MonitorDetailActions({ monitor }: { monitor: Monitor }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CheckNowButton monitorId={monitor.id} variant="primary" />
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page"
        >
          Edit
        </button>
        <DeleteMonitorButton
          monitorId={monitor.id}
          monitorName={monitor.name}
        />
      </div>
      <Overlay
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit monitor"
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
