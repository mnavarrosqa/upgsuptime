"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const syncVisibility = () => {
      clearInterval(id);
      if (document.visibilityState !== "visible") return;
      router.refresh();
      id = setInterval(() => router.refresh(), intervalMs);
    };
    if (document.visibilityState === "visible") {
      id = setInterval(() => router.refresh(), intervalMs);
    }
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [router, intervalMs]);
  return null;
}
