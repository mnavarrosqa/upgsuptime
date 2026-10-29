"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { BellRing, Smartphone } from "lucide-react";
import { useApiErrorMessage, type ApiErrorPayload } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Spinner } from "@/components/spinner";

type AppSession = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  pushEnabled: boolean;
};

/** Pending sign-out: one device by id, or every device. */
type PendingSignOut = { kind: "one"; session: AppSession } | { kind: "all" } | null;

export function AppSessionsSection() {
  const t = useTranslations("account");
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();
  const [sessions, setSessions] = useState<AppSession[] | null>(null);
  // Reference time for relative labels, fixed when the list loads.
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [pending, setPending] = useState<PendingSignOut>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/app-sessions");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(apiErrorMessage(data as ApiErrorPayload));
      setSessions([]);
      return;
    }
    setSessions(data as AppSession[]);
    setLoadedAt(new Date());
  }, [apiErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const deviceLabel = (s: AppSession) => s.deviceName ?? t("appSessionsUnnamed");

  async function confirmSignOut() {
    if (!pending) return;
    setBusy(true);
    try {
      const url = pending.kind === "one" ? `/api/user/app-sessions/${pending.session.id}` : "/api/user/app-sessions";
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(apiErrorMessage(data as ApiErrorPayload));
        return;
      }
      toast.success(pending.kind === "one" ? t("appSessionsSignedOut") : t("appSessionsAllSignedOut"));
      setPending(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h2
        className="text-base font-semibold text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("appSessionsTitle")}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">{t("appSessionsSubtitle")}</p>

      <div className="mt-4 rounded-lg border border-border bg-bg-card">
        {sessions === null ? (
          <div className="flex justify-center px-6 py-5" aria-busy="true">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-6 py-5 text-sm text-text-muted">{t("appSessionsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <Smartphone className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{deviceLabel(s)}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {t("appSessionsLastActive", { when: format.relativeTime(new Date(s.lastUsedAt), loadedAt) })}
                    {" · "}
                    {t("appSessionsSignedIn", { when: format.relativeTime(new Date(s.createdAt), loadedAt) })}
                  </p>
                  {s.pushEnabled && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
                      <BellRing className="h-3 w-3" aria-hidden />
                      {t("appSessionsPush")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPending({ kind: "one", session: s })}
                  aria-label={`${t("appSessionsSignOut")}: ${deviceLabel(s)}`}
                >
                  {t("appSessionsSignOut")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">{t("appSessionsPasswordNote")}</p>
        {sessions && sessions.length > 1 && (
          <Button type="button" variant="outline" onClick={() => setPending({ kind: "all" })}>
            {t("appSessionsSignOutAll")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "all" ? t("appSessionsConfirmAllTitle") : t("appSessionsConfirmTitle")}
        message={
          pending?.kind === "one"
            ? t("appSessionsConfirmBody", { device: deviceLabel(pending.session) })
            : t("appSessionsConfirmAllBody")
        }
        confirmLabel={pending?.kind === "all" ? t("appSessionsSignOutAll") : t("appSessionsSignOut")}
        destructive
        busy={busy}
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
