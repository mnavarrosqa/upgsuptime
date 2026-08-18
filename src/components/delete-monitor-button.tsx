"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function DeleteMonitorButton({
  monitorId,
  monitorName,
}: {
  monitorId: string;
  monitorName: string;
}) {
  const t = useTranslations("monitorsPage");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("deleteSuccessSingle", { name: monitorName }));
        router.replace("/dashboard");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("deleteFailed"));
        setConfirmOpen(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        className="rounded-md px-4 py-2 text-sm font-medium"
      >
        {deleting && <Spinner size="sm" />}
        {deleting ? t("deleting") : t("delete")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={t("deleteMonitorTitle")}
        message={t("deleteSingleMessage", { name: monitorName })}
        confirmLabel={t("delete")}
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
