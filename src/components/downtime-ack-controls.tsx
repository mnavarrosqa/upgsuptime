"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

export function DowntimeAckBadge({ className }: { className?: string }) {
  const t = useTranslations("monitorDetail");
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200",
        className
      )}
    >
      {t("downtimeAckBadge")}
    </span>
  );
}

export function DowntimeAckControls({
  monitorId,
  show,
  isAcked,
}: {
  monitorId: string;
  show: boolean;
  isAcked: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("monitorDetail");
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  async function post(acknowledged: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/ack-downtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      router.refresh();
      toast.success(acknowledged ? t("downtimeAckToast") : t("downtimeUndoToast"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {isAcked ? (
        <>
          <DowntimeAckBadge />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => post(false)}
            className="inline-flex items-center gap-2 rounded-md border-border text-text-primary"
          >
            {loading ? <Spinner size="sm" /> : null}
            {t("downtimeUndoAck")}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => post(true)}
          className="inline-flex items-center gap-2 rounded-md border-border text-text-primary"
        >
          {loading ? <Spinner size="sm" /> : null}
          {t("downtimeAcknowledge")}
        </Button>
      )}
    </div>
  );
}
