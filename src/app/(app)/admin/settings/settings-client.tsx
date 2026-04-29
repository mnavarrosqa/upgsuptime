"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminSettings } from "./page";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDashed } from "lucide-react";

export function AdminSettingsClient({
  settings: initial,
}: {
  settings: AdminSettings;
}) {
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
        toast.error(data.error ?? "Failed to save");
        return;
      }

      setRegistrationEnabled(next);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
      <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-medium">User registration</h2>
            <p className="text-sm text-text-muted">
              Control whether new users can create accounts from the public sign-up
              page.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleToggle}
            disabled={saving}
            role="switch"
            aria-checked={registrationEnabled}
            aria-label="Toggle user registration"
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
                ? "New sign-ups are allowed"
                : "New sign-ups are blocked"}
            </div>
            <span className="rounded-full border border-border bg-bg-card px-2 py-0.5 text-xs font-medium text-text-muted">
              {registrationEnabled ? "Open" : "Closed"}
            </span>
          </div>
          <div className="mt-1 text-text-muted">
            When disabled, the register page rejects new account creation.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">SMTP / Email</h2>
            <p className="mt-1 text-sm text-text-muted">
              Email alerts are configured through deployment environment variables.
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
          Set every required variable to enable outbound notifications.
        </p>
        <div className="mt-4 space-y-2">
          {Object.entries(initial.smtpVarsSet).map(([key, set]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-page px-3 py-2 text-sm"
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
                {set ? "Set" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
