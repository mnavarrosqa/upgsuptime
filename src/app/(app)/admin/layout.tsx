import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSubNav } from "@/components/admin-sub-nav";
import { getTranslations } from "next-intl/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, t] = await Promise.all([
    getServerSession(authOptions),
    getTranslations("admin"),
  ]);
  if (session?.user?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1
        className="text-2xl font-semibold tracking-tight text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("overview.heading")}
      </h1>
      <p className="mt-1 text-sm text-text-muted">{t("overview.subtitle")}</p>
      <AdminSubNav />
      <div className="mt-6 md:mt-8">{children}</div>
    </div>
  );
}
