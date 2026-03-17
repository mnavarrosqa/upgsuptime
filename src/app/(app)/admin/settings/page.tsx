import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSettingsClient } from "./settings-client";

export interface AdminSettings {
  registrationEnabled: boolean;
  smtpConfigured: boolean;
  smtpVarsSet: Record<string, boolean>;
}

async function getSettings(): Promise<AdminSettings> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/admin/settings`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">App-wide configuration</p>
      </div>
      <AdminSettingsClient settings={settings} />
    </div>
  );
}
