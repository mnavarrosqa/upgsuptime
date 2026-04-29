import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdminSettingsClient } from "./settings-client";
import { AdminSubNav } from "@/components/admin-sub-nav";

export interface AdminSettings {
  registrationEnabled: boolean;
  smtpConfigured: boolean;
  smtpVarsSet: Record<string, boolean>;
}

const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

export default async function AdminSettingsPage() {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "registrationEnabled"));

  const registrationEnabled = row ? row.value !== "false" : true;
  const smtpVarsSet = SMTP_VARS.reduce<Record<string, boolean>>((acc, v) => {
    acc[v] = !!process.env[v];
    return acc;
  }, {});
  const smtpConfigured = Object.values(smtpVarsSet).every(Boolean);

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Configuration
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              Control sign-ups and verify deployment-level notification settings.
            </p>
          </div>
        </div>
      </div>
      <AdminSubNav />
      <AdminSettingsClient
        settings={{ registrationEnabled, smtpConfigured, smtpVarsSet }}
      />
    </div>
  );
}
