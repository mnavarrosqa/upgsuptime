"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function CheckNowButton({
  monitorId,
  variant: tone = "secondary",
}: {
  monitorId: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("monitorsPage");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/check-now`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? data.message ?? t("checkNowFailed"));
        return;
      }
      await router.refresh();
      toast.success(t("checkComplete"));
    } catch {
      toast.error(t("checkNowFailed"));
    } finally {
      setLoading(false);
    }
  }

  const buttonClass =
    tone === "primary"
      ? "rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
      : "rounded-md border border-border-muted px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page";

  return (
    <Button
      type="button"
      variant={tone === "primary" ? "default" : "outline"}
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 ${buttonClass}`}
    >
      {loading && <Spinner size="sm" />}
      {loading ? t("checking") : t("checkNow")}
    </Button>
  );
}
