"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminSettings } from "./page";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminSettingsClient({
  settings: initial,
}: {
  settings: AdminSettings;
}) {
  const t = useTranslations("admin.settings");
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initial.registrationEnabled
  );
  const [saving, setSaving] = useState(false);
  const configuredCount = Object.values(initial.smtpVarsSet).filter(Boolean).length;
  const totalSmtpVars = Object.keys(initial.smtpVarsSet).length;

  async function handleToggle() {
    const next = !registrationEnabled;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled: next }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("failedToSave"));
        return;
      }

      setRegistrationEnabled(next);
      toast.success(t("settingsSaved"));
    } catch {
      toast.error(t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
      <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-medium">{t("registrationTitle")}</h2>
            <p className="text-sm text-text-muted">
              {t("registrationDesc")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleToggle}
            disabled={saving}
            role="switch"
            aria-checked={registrationEnabled}
            aria-label={t("toggleAriaLabel")}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0 transition-colors hover:bg-transparent focus-visible:ring-2 disabled:opacity-60 ${
              registrationEnabled ? "bg-primary" : "bg-border-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-bg-card shadow-sm transition-transform ${
                registrationEnabled ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </Button>
        </div>
        <div className="mt-5 rounded-xl border border-border bg-bg-page p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">
              {registrationEnabled
                ? t("signupsAllowed")
                : t("signupsBlocked")}
            </div>
            <span className="rounded-full border border-border bg-bg-card px-2 py-0.5 text-xs font-medium text-text-muted">
              {registrationEnabled ? t("statusOpen") : t("statusClosed")}
            </span>
          </div>
          <div className="mt-1 text-text-muted">
            {t("registrationDisabledHint")}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">{t("smtpTitle")}</h2>
            <p className="mt-1 text-sm text-text-muted">
              {t("smtpDesc")}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
              initial.smtpConfigured
                ? "bg-green-500/10 text-green-700 dark:text-green-300"
                : "bg-bg-page text-text-muted"
            }`}
          >
            {initial.smtpConfigured ? (
              <CheckCircle2 className="size-3.5" aria-hidden />
            ) : (
              <CircleDashed className="size-3.5" aria-hidden />
            )}
            {configuredCount}/{totalSmtpVars}
          </span>
        </div>
        <p className="text-sm text-text-muted">
          {t("smtpSetHint")}
        </p>
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3 dark:bg-muted/20">
          {Object.entries(initial.smtpVarsSet).map(([key, set]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm"
            >
              <code className="text-xs">{key}</code>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                  set
                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                    : "bg-bg-card text-text-muted"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${set ? "bg-green-500" : "bg-border-muted"}`}
                  aria-hidden
                />
                {set ? t("smtpVarSet") : t("smtpVarMissing")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
