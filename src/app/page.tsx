import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { settings, user } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertEmailPreview,
  DashboardWindow,
  MonitorSetupPreview,
  StatusPagePreview,
  type PreviewMonitor,
} from "@/components/landing/landing-previews";
import { formatNumber, formatPercent } from "@/lib/number-format";

/** 30 days, oldest first: u = up, w = some failed checks, d = down. */
const STRIPS = {
  calm: "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
  payments: "uuuuuuuuuuuuuuuuuuuuuwuuuuuuud",
  portal: "uuuuuuuuuuwuuuuuuuuuuuuuuuuuuu",
  shop: "uuuuuuuuuuuuuuuuuuuuuuuuuwuuuu",
  mail: "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
  blog: "uuuuuuuwuuuuuuuuuuuuuuuuuuuuuu",
} as const;

export default async function HomePage() {
  const [[row], [registrationRow], session, t, tCommon, tNav, tOverview, tDash, tEmails, tPublic, locale] =
    await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ value: settings.value }).from(settings).where(eq(settings.key, "registrationEnabled")),
      getServerSession(authOptions),
      getTranslations("landing"),
      getTranslations("common"),
      getTranslations("nav"),
      getTranslations("overview"),
      getTranslations("dashboard"),
      getTranslations("emails"),
      getTranslations("publicStatus"),
      getLocale(),
    ]);

  if (row.count === 0) redirect("/setup");
  if (session) redirect("/dashboard");

  // The main action follows the admin setting: sign up when it is open, sign in otherwise.
  const registrationOpen = registrationRow ? registrationRow.value !== "false" : true;
  const primary = registrationOpen
    ? { href: "/register", label: t("ctaRegister") }
    : { href: "/login", label: tCommon("signIn") };

  const es = locale === "es";
  const pct = (n: number) => formatPercent(n, locale, 2);
  const names = es
    ? { site: "Sitio web", payments: "API de pagos", portal: "Panel de clientes", shop: "Tienda online", mail: "Correo", blog: "Blog" }
    : { site: "Website", payments: "Payments API", portal: "Customer portal", shop: "Online store", mail: "Mail", blog: "Blog" };
  const exampleUrl = "https://api.example.com/health";

  const monitors: PreviewMonitor[] = [
    {
      name: names.payments,
      strip: STRIPS.payments,
      uptime: pct(99.62),
      status: "down",
      statusText: `${tOverview("down")} · ${es ? "4 min" : "4m"}`,
      detail: `${tEmails("statusCode")} 503`,
    },
    { name: names.site, strip: STRIPS.calm, uptime: pct(100), status: "up", statusText: "182 ms" },
    { name: names.portal, strip: STRIPS.portal, uptime: pct(99.91), status: "up", statusText: "240 ms" },
    { name: names.shop, strip: STRIPS.shop, uptime: pct(99.87), status: "up", statusText: "310 ms" },
    { name: names.mail, strip: STRIPS.mail, uptime: pct(100), status: "up", statusText: "64 ms" },
    { name: names.blog, strip: STRIPS.blog, uptime: pct(99.95), status: "up", statusText: "205 ms" },
  ];

  const steps = [
    {
      id: "add",
      title: t("step1Title"),
      body: t("step1Body"),
      visual: (
        <MonitorSetupPreview
          title={t("setupTitle")}
          urlLabel={t("setupUrl")}
          url={exampleUrl}
          typeLabel={t("setupType")}
          types={["HTTP", t("setupKeyword"), "DNS", "TCP"]}
          intervalLabel={t("setupInterval")}
          interval={t("setupEvery")}
          ssl={t("setupSsl")}
          save={t("setupSave")}
        />
      ),
    },
    {
      id: "alert",
      title: t("step2Title"),
      body: t("step2Body"),
      visual: (
        <AlertEmailPreview
          inbox={t("emailInbox")}
          when={t("emailWhen")}
          badge={tEmails("uptime.badgeDown")}
          headline={tEmails.rich("uptime.headlineDown", {
            name: names.payments,
            strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
          url={exampleUrl}
          ackButton={tEmails("uptime.ackButton")}
          viewButton={tEmails("viewMonitor")}
          rows={[
            { label: tEmails("uptime.cause"), value: `${tEmails("statusCode")} 503` },
            { label: tEmails("uptime.startedAt"), value: es ? "14:32" : "2:32 PM" },
            { label: tEmails("responseTime"), value: `${formatNumber(1240, locale)} ms` },
          ]}
        />
      ),
    },
    {
      id: "share",
      title: t("step3Title"),
      body: t("step3Body"),
      visual: (
        <StatusPagePreview
          company={t("statusPageCompany")}
          title={t("statusPageTitle")}
          servicesHeading={tPublic("servicesHeading")}
          services={[
            { name: names.site, up: true, label: tPublic("statusOperational"), strip: STRIPS.calm, uptime: pct(100) },
            { name: names.payments, up: false, label: tPublic("statusUnavailable"), strip: STRIPS.payments, uptime: pct(99.62) },
            { name: names.portal, up: true, label: tPublic("statusOperational"), strip: STRIPS.portal, uptime: pct(99.91) },
            { name: names.shop, up: true, label: tPublic("statusOperational"), strip: STRIPS.shop, uptime: pct(99.87) },
          ]}
        />
      ),
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      {/* ── Header ── */}
      <header className="safe-top mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <span className="flex items-center gap-2.5 font-display text-base font-medium tracking-tight text-text-primary">
          <BrandMark className="size-7 shrink-0" />
          UPG Monitor
        </span>
        <nav className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="px-1 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-text-primary"
          >
            {tCommon("signIn")}
          </Link>
          {registrationOpen ? (
            <Link
              href="/register"
              className="hidden h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg-page transition-colors duration-150 hover:bg-accent-hover sm:inline-flex"
            >
              {t("ctaRegister")}
            </Link>
          ) : null}
        </nav>
      </header>

      {/* ── Hero: headline and actions over the product itself ── */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-12 sm:pt-20 lg:pt-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12">
          <h1 className="font-display text-[clamp(2.25rem,6vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.03em] text-text-primary">
            {t("headlinePart1")}
            <br />
            <span className="text-text-muted">{t("headlinePart2")}</span>
          </h1>
          <div className="lg:pb-2">
            <p className="max-w-[36rem] text-[clamp(1rem,1.6vw,1.125rem)] leading-relaxed text-text-muted">
              {t("subheadline")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={primary.href}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-bg-page transition-colors duration-150 hover:bg-accent-hover sm:w-auto"
              >
                {primary.label}
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-bg-card px-5 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-page sm:w-auto"
              >
                {t("explore")}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 sm:mt-16">
          <DashboardWindow
            address={t("windowAddress")}
            nav={{ dashboard: tNav("dashboard"), monitors: tNav("monitors"), activity: tNav("activity") }}
            headline={tDash("downCount", { count: 1 })}
            meta={`${tDash("monitorCount", { count: monitors.length })} · ${tDash("checksFrom", { location: "Santiago" })}`}
            stats={[
              { label: tOverview("availability7d"), value: formatPercent(99.8, locale) },
              { label: tOverview("response7d"), value: "164 ms" },
              { label: tOverview("downtimeLabel"), value: tOverview("downtimeMinutes", { n: 42 }) },
              { label: tOverview("certificateLabel"), value: tOverview("sslDays", { n: 23 }) },
            ]}
            monitors={monitors}
          />
          <p className="mt-3 text-right text-xs text-text-muted">{t("previewLabel")}</p>
        </div>
      </section>

      {/* ── How it works: one step per row, each with the screen it produces ── */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 pt-24 sm:pt-32">
        <h2 className="max-w-xl font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium leading-tight tracking-[-0.02em] text-text-primary">
          {t("howTitle")}
        </h2>
        <ol className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16"
            >
              <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                <p className="text-sm tabular-nums text-text-muted">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 font-display text-xl font-medium tracking-tight text-text-primary sm:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[34rem] leading-relaxed text-text-muted">{step.body}</p>
              </div>
              <div className="min-w-0">{step.visual}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Closing ── */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
        <div className="flex flex-col justify-between gap-6 border-y border-border py-10 sm:flex-row sm:items-center sm:py-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-text-primary sm:text-3xl">
            {t("closingTitle")}
          </h2>
          <Link
            href={primary.href}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-bg-page transition-colors duration-150 hover:bg-accent-hover"
          >
            {primary.label}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2.5 text-sm font-medium text-text-primary">
            <BrandMark className="size-5 shrink-0" />
            UPG Monitor
          </span>
          <Link
            href="/login"
            className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
          >
            {tCommon("signIn")}
          </Link>
        </div>
      </footer>
    </main>
  );
}
