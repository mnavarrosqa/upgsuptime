"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Overlay } from "@/components/overlay";
import { AddMonitorFlow } from "@/components/add-monitor-flow";
import { Button } from "@/components/ui/button";

export function DashboardAddMonitor() {
  const router = useRouter();
  const t = useTranslations("monitorsPage");
  const [addOpen, setAddOpen] = useState(false);
  const [addFormDirty, setAddFormDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  function closeAddOverlay() {
    setAddFormDirty(false);
    setConfirmCloseOpen(false);
    setAddOpen(false);
  }

  function handleAddCloseRequest() {
    if (addFormDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    closeAddOverlay();
  }

  function handleSuccess() {
    closeAddOverlay();
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
        onClose={handleAddCloseRequest}
        title={t("addMonitorTitle")}
        panelClassName="max-w-2xl"
      >
        <AddMonitorFlow
          onSuccess={handleSuccess}
          onCancel={closeAddOverlay}
          onDirtyChange={setAddFormDirty}
        />
      </Overlay>
      <ConfirmDialog
        open={confirmCloseOpen}
        title={t("unsavedAddMonitorTitle")}
        message={t("unsavedAddMonitorMessage")}
        confirmLabel={t("leaveForm")}
        destructive
        onConfirm={closeAddOverlay}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  );
}
