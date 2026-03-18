"use client";

import { Overlay } from "@/components/overlay";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
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
  return (
    <Overlay open={open} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-text-muted">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-page disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            destructive
              ? "bg-red-600 hover:bg-red-700"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
