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
  const smtpConfigured = !!process.env.SMTP_HOST;
  const smtpVarsSet = SMTP_VARS.reduce<Record<string, boolean>>((acc, v) => {
    acc[v] = !!process.env[v];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
      </div>
      <AdminSubNav />
      <AdminSettingsClient
        settings={{ registrationEnabled, smtpConfigured, smtpVarsSet }}
      />
    </div>
  );
}
