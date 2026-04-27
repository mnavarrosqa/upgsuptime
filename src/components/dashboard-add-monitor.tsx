"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Overlay } from "@/components/overlay";
import { AddMonitorFlow } from "@/components/add-monitor-flow";
import { Button } from "@/components/ui/button";

export function DashboardAddMonitor() {
  const router = useRouter();
  const t = useTranslations("monitorsPage");
  const [addOpen, setAddOpen] = useState(false);

  function handleSuccess() {
    setAddOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setAddOpen(true)}
        className="rounded-md px-4 py-2 text-sm font-medium"
      >
        {t("addMonitor")}
      </Button>
      <Overlay
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("addMonitorTitle")}
        panelClassName="max-w-2xl"
      >
        <AddMonitorFlow onSuccess={handleSuccess} onCancel={() => setAddOpen(false)} />
      </Overlay>
    </>
  );
}
