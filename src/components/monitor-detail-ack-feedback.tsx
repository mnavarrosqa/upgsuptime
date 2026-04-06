"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Shows toast for ?ack= from email link redirect, then strips query params.
 */
export function MonitorDetailAckFeedback({ ackParam }: { ackParam?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("monitorDetail");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !ackParam) return;
    handled.current = true;

    if (ackParam === "email") {
      toast.success(t("downtimeAckFromEmailToast"));
    } else if (ackParam === "invalid") {
      toast.error(t("downtimeAckEmailInvalid"));
    } else if (ackParam === "expired") {
      toast.error(t("downtimeAckEmailExpired"));
    }

    router.replace(pathname, { scroll: false });
  }, [ackParam, pathname, router, t]);

  return null;
}
