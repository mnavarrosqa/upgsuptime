import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingHeroCarousel } from "@/components/landing-hero-carousel";
const MOCK_MONITORS = [
  { name: "api.production", status: true,  uptime: "99.97", ms: "112ms", bars: "11111111111111111111" },
  { name: "app.production", status: true,  uptime: "99.81", ms: "88ms",  bars: "11111111011111111111" },
  { name: "auth.service",   status: false, uptime: "97.40", ms: "—",     bars: "11111100111100111000" },
  { name: "cdn.assets",     status: true,  uptime: "100.0", ms: "14ms",  bars: "11111111111111111111" },
  { name: "db.replica",     status: true,  uptime: "99.92", ms: "31ms",  bars: "11111011111111111111" },
];

export default async function HomePage() {
  // Start session and translations fetches immediately; user-count check is cheap
  // and synchronous relative to the DB call, so we kick everything off in parallel.
  const [[row], session, t, tCommon, tActivity, tDetail, locale] = await Promise.all([
    db.select({ count: count() }).from(user),
    getServerSession(authOptions),
    getTranslations("landing"),
    getTranslations("common"),
    getTranslations("activity"),
    getTranslations("monitorDetail"),
    getLocale(),
  ]);

  if (row.count === 0) redirect("/setup");
  if (session) redirect("/dashboard");
  const upCount = MOCK_MONITORS.filter((m) => m.status).length;
  const es = locale === "es";

  const mockDetailRows = es
    ? [
        { time: "22:23", code: "503", ms: "1245 ms", ok: false },
        { time: "22:21", code: "503", ms: "987 ms", ok: false },
        { time: "22:18", code: "0", ms: "—", ok: false },
        { time: "21:41", code: "503", ms: "1102 ms", ok: false },
        { time: "20:55", code: "200", ms: "108 ms", ok: true },
      ]
    : [
        { time: "10:23 PM", code: "503", ms: "1245 ms", ok: false },
        { time: "10:21 PM", code: "503", ms: "987 ms", ok: false },
        { time: "10:18 PM", code: "0", ms: "—", ok: false },
        { time: "9:41 PM", code: "503", ms: "1102 ms", ok: false },
        { time: "8:55 PM", code: "200", ms: "108 ms", ok: true },
      ];

  const mockActivityRows = es
    ? [
        { name: "api.production", down: false, when: "2 min" },
        { name: "auth.service", down: true, when: "14 min" },
        { name: "app.production", down: false, when: "1 h" },
        { name: "auth.service", down: true, when: "1 h" },
        { name: "cdn.assets", down: false, when: "3 h" },
        { name: "db.replica", down: false, when: "5 h" },
      ]
    : [
        { name: "api.production", down: false, when: "2m" },
        { name: "auth.service", down: true, when: "14m" },
        { name: "app.production", down: false, when: "1h" },
        { name: "auth.service", down: true, when: "1h" },
        { name: "cdn.assets", down: false, when: "3h" },
        { name: "db.replica", down: false, when: "5h" },
      ];

  return (
    <main className="landing-page min-h-screen bg-bg-page text-text-primary flex flex-col">
      {/* ── Header ── */}
      <header className="safe-top max-w-6xl mx-auto w-full px-6 pt-6 pb-4 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 text-sm font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <BrandMark className="size-8 shrink-0" />
          <span className="tracking-tight">UPG Monitor</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150 font-medium"
          >
            {tCommon("signIn")}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-12 pb-16 sm:pt-14 sm:pb-20 md:pt-16 md:pb-24 grid md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,450px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,470px)] gap-12 md:gap-10 lg:gap-12 xl:gap-16 items-center">
        {/* Copy */}
        <div className="flex flex-col gap-5 sm:gap-6 md:gap-5 lg:gap-6 lg:pt-2">
          <div className="flex items-center gap-4">
            <BrandMark animated className="landing-orbit size-14 shrink-0 sm:size-16" />
            <p className="max-w-[24ch] text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold">
              {t("eyebrow")}
            </p>
          </div>
          <h1 className="font-display font-semibold text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[1.06] tracking-tight text-text-primary max-w-[13ch] sm:max-w-[14ch]">
            {t("headlinePart1")}<br />
            {t("headlinePart2")}
          </h1>
          <p className="text-[clamp(0.9375rem,2vw,1.0625rem)] text-text-muted leading-[1.65] max-w-[34ch] sm:max-w-[38ch] md:max-w-[34ch] lg:max-w-[40ch]">
            {t("subheadline")}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1.5">
            <Link
              href="/login"
              className="inline-flex w-full justify-center sm:w-auto items-center px-5 py-2.5 bg-accent text-bg-page text-sm font-semibold rounded-lg hover:bg-accent-hover transition-colors duration-150"
            >
              {t("cta")}
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex w-full justify-center sm:w-auto items-center px-4 py-2.5 text-sm font-medium text-text-muted border border-border rounded-lg hover:text-text-primary hover:bg-bg-card transition-colors duration-150"
            >
              {t("explore")} <span aria-hidden className="ml-2">↓</span>
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            {t("heroReassurance")}
          </p>

          <ul className="flex flex-wrap items-center gap-2.5 pt-1">
            {([t("bullet1"), t("bullet2"), t("bullet3")] as const).map((label) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 py-1.5 text-[11px] sm:text-[12px] text-text-muted"
              >
                <span className="size-1 rounded-full bg-text-muted/45 inline-block flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 w-full">
        <p className="mb-4 text-xs text-text-muted">{t("previewLabel")}</p>
        <LandingHeroCarousel
          monitors={MOCK_MONITORS}
          detailRows={mockDetailRows}
          activityRows={mockActivityRows}
          upCount={upCount}
          labels={{
            panelTitle: t("panelTitle"),
            panelStatus: t("panelStatus", { up: upCount, total: MOCK_MONITORS.length }),
            panelFooter: t("panelFooter"),
            dashboardTitle: t("screenDashboardTitle"),
            dashboardBadge: t("screenDashboardBadge"),
            dashboardStat: t("screenDashboardStat"),
            detailOverview: tDetail("heroEyebrow"),
            statusDown: t("mockStatusDown"),
            configEvery: tDetail("configEvery", { n: 1 }),
            configTimeout: tDetail("configTimeout", { n: 10 }),
            configSslOn: tDetail("configSslOn"),
            checkLogTitle: tDetail("checkLogTitle"),
            colTime: t("mockColTime"),
            colCode: t("mockColCode"),
            colResponse: t("mockColResponse"),
            activityTitle: t("screenActivityTitle"),
            activityCount: t("screenActivityCount"),
            activityEventCount: tActivity("eventCount", { count: 8 }),
            wentDown: t("mockWentDown"),
            recovered: t("mockRecovered"),
            carouselLabel: t("carouselLabel"),
            previousLabel: tActivity("previous"),
            nextLabel: tActivity("next"),
            pauseLabel: t("carouselPause"),
            playLabel: t("carouselPlay"),
            indicatorLabel: t("carouselIndicator", { index: "{index}" }),
            slideLabel: t("carouselSlideLabel", { current: "{current}", total: "{total}" }),
          }}
        />
        </div>
      </section>
      {/* ── Why it matters ── */}
      <section id="how-it-works" className="scroll-mt-8 max-w-6xl mx-auto w-full px-6 pt-10 pb-14 sm:pt-12 sm:pb-16 md:pt-14 md:pb-18 border-t border-border">
        <div className="mb-8 sm:mb-9 md:mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold mb-3">
            {t("whyEyebrow")}
          </p>
          <h2 className="font-display font-semibold text-[clamp(1.4rem,3vw,1.875rem)] leading-tight tracking-tight text-text-primary max-w-lg">
            {t("whyTitle")}
          </h2>
        </div>

        <div className="divide-y divide-border">
          {([
            { num: "01", title: t("why1Title"), body: t("why1Body") },
            { num: "02", title: t("why2Title"), body: t("why2Body") },
            { num: "03", title: t("why3Title"), body: t("why3Body") },
          ] as const).map((item) => (
            <div key={item.num} className="py-5 sm:py-6 grid md:grid-cols-[2rem_1fr_2fr] gap-3 md:gap-10 items-baseline">
              <span className="text-[11px] text-text-muted tabular-nums font-semibold">{item.num}</span>
              <h3 className="font-display font-semibold text-text-primary">{item.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-14 pb-12 sm:pt-16 sm:pb-14 border-t border-border">
        <h2 className="font-display text-2xl font-semibold tracking-tight mb-8">{t("featuresTitle")}</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {([
            { step: "01", title: t("feature1Title"), body: t("feature1Body") },
            { step: "02", title: t("feature2Title"), body: t("feature2Body") },
            { step: "03", title: t("feature3Title"), body: t("feature3Body") },
            { step: "04", title: t("feature4Title"), body: t("feature4Body") },
          ] as const).map((f) => (
            <div key={f.title} className="border-t border-border pt-5 pb-3">
              <span className="inline-flex mb-3 h-5 min-w-5 items-center justify-center rounded-full border border-border bg-bg-page px-1.5 text-[10px] font-semibold tabular-nums text-text-muted">
                {f.step}
              </span>
              <h3 className="font-display font-semibold text-text-primary mb-2.5 leading-snug">
                {f.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto w-full px-6 py-14 sm:py-20">
        <div className="border-y border-border py-10 sm:py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-7">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">{t("closingTitle")}</h2>
            <p className="mt-3 text-sm text-text-muted">{t("heroReassurance")}</p>
          </div>
          <Link href="/login" className="inline-flex shrink-0 items-center justify-center gap-3 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg-page hover:bg-accent-hover transition-colors">
            {t("cta")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border px-6 py-6 sm:py-7">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-text-primary">
            <BrandMark className="size-6 shrink-0" />
            <span>UPG Monitor</span>
          </span>
          <Link
            href="/login"
            className="inline-flex items-center text-xs text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            {tCommon("signIn")} →
          </Link>
        </div>
      </footer>
    </main>
  );
}
