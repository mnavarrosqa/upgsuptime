"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Overlay } from "@/components/overlay";
import { AddMonitorFlow } from "@/components/add-monitor-flow";

export function DashboardAddMonitor() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  function handleSuccess() {
    setAddOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
      >
        Add monitor
      </button>
      <Overlay
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add monitor"
      >
        <AddMonitorFlow onSuccess={handleSuccess} onCancel={() => setAddOpen(false)} />
      </Overlay>
    </>
  );
}
