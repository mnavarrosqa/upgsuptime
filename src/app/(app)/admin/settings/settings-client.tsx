"use client";

import { useState } from "react";
import type { AdminSettings } from "./page";

export function AdminSettingsClient({
  settings: initial,
}: {
  settings: AdminSettings;
}) {
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initial.registrationEnabled
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleToggle() {
    const next = !registrationEnabled;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationEnabled: next }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
      return;
    }

    setRegistrationEnabled(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Registration */}
      <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
        <h2 className="font-medium">User Registration</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Allow new registrations</div>
            <div className="text-xs text-text-muted mt-0.5">
              When disabled, the /register page returns an error for new sign-ups.
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            role="switch"
            aria-checked={registrationEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-60 ${
              registrationEnabled ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                registrationEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-green-600 dark:text-green-400">Saved</div>
        )}
      </div>

      {/* SMTP */}
      <div className="rounded-lg border border-border bg-bg-card p-4 space-y-3">
        <h2 className="font-medium">SMTP / Email</h2>
        <p className="text-sm text-text-muted">
          Email alerts are configured via environment variables. Set them in your
          deployment environment to enable outbound notifications.
        </p>
        <div className="space-y-1">
          {Object.entries(initial.smtpVarsSet).map(([key, set]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${set ? "bg-green-500" : "bg-border"}`}
              />
              <code className="text-xs">{key}</code>
              <span className="text-text-muted">{set ? "set" : "not set"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
