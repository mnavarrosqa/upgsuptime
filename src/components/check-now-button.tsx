"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";

export function CheckNowButton({
  monitorId,
  variant = "secondary",
}: {
  monitorId: string;
  variant?: "primary" | "secondary";
}) {
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
        toast.error(data.error ?? data.message ?? "Check failed");
        return;
      }
      router.refresh();
      toast.success("Check complete");
    } catch {
      toast.error("Check failed");
    } finally {
      setLoading(false);
    }
  }

  const buttonClass =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
      : "inline-flex items-center justify-center gap-2 rounded-md border border-border-muted px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page disabled:opacity-60";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={buttonClass}
    >
      {loading && <Spinner size="sm" />}
      {loading ? "Checking…" : "Check now"}
    </button>
  );
}
