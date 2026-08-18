import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdminSettingsClient } from "./settings-client";
import { getTranslations } from "next-intl/server";

export interface AdminSettings {
  registrationEnabled: boolean;
  smtpConfigured: boolean;
  smtpVarsSet: Record<string, boolean>;
}

const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin.settings");

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
    <div className="space-y-6">
      <div>
        <h2
          className="text-lg font-semibold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("heading")}
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {t("subtitle")}
        </p>
      </div>
      <AdminSettingsClient
        settings={{ registrationEnabled, smtpConfigured, smtpVarsSet }}
      />
    </div>
  );
}
