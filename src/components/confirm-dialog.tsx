"use client";

import { useTranslations } from "next-intl";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("common");

  return (
    <Overlay open={open} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-text-muted">{message}</p>
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          onClick={onCancel}
          disabled={busy}
          variant="outline"
          className="rounded-lg px-4 py-2 text-sm font-medium"
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          variant={destructive ? "destructive" : "default"}
          className="rounded-lg px-4 py-2 text-sm font-medium"
        >
          {busy ? t("pleaseWait") : (confirmLabel ?? t("confirm"))}
        </Button>
      </div>
    </Overlay>
  );
}
