"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";

export function DeleteMonitorButton({
  monitorId,
  monitorName,
}: {
  monitorId: string;
  monitorName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${monitorName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/monitors");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-60"
    >
      {deleting && <Spinner size="sm" />}
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
