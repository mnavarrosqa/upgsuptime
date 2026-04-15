import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HeartPulse } from "lucide-react";
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
  const [[row], session, t, tCommon, tDash, tActivity, tDetail, tTime, locale] = await Promise.all([
    db.select({ count: count() }).from(user),
    getServerSession(authOptions),
    getTranslations("landing"),
    getTranslations("common"),
    getTranslations("dashboard"),
    getTranslations("activity"),
    getTranslations("monitorDetail"),
    getTranslations("time"),
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
    <main className="min-h-screen bg-bg-page text-text-primary flex flex-col">
      {/* ── Header ── */}
      <header className="safe-top max-w-6xl mx-auto w-full px-6 pt-6 pb-4 flex items-center justify-between">
        <div
          className="flex items-center gap-2 text-sm font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <HeartPulse className="size-4 shrink-0" />
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
      <section className="max-w-6xl mx-auto w-full px-6 pt-12 pb-16 sm:pt-14 sm:pb-20 md:pt-16 md:pb-24 grid md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,450px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,470px)] gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-start">
        {/* Copy */}
        <div className="flex flex-col gap-5 sm:gap-6 md:gap-5 lg:gap-6 lg:pt-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold">
            {t("eyebrow")}
          </p>
          <h1 className="font-display font-semibold text-[clamp(2.2rem,6vw,4.25rem)] leading-[1.06] tracking-tight text-text-primary max-w-[13ch] sm:max-w-[14ch]">
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
              href="/login"
              className="inline-flex w-full justify-center sm:w-auto items-center px-4 py-2.5 text-sm font-medium text-text-muted border border-border rounded-lg hover:text-text-primary hover:bg-bg-card transition-colors duration-150"
            >
              {tCommon("signIn")}
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            {t("heroReassurance")}
          </p>

          <ul className="flex flex-wrap items-center gap-2.5 pt-1">
            {([t("bullet1"), t("bullet2"), t("bullet3")] as const).map((label) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card/70 px-3 py-1.5 text-[11px] sm:text-[12px] text-text-muted"
              >
                <span className="size-1 rounded-full bg-text-muted/45 inline-block flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>

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
      </section>
      <section className="max-w-6xl mx-auto w-full px-6 pb-10 sm:pb-12">
        <div className="rounded-xl border border-border bg-bg-card/70 px-4 py-3">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {([t("bullet1"), t("bullet2"), t("bullet3")] as const).map((item) => (
              <li key={`trust-${item}`} className="inline-flex items-center gap-2 text-xs text-text-muted">
                <span className="size-1 rounded-full bg-emerald-500/70 inline-block" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Why it matters ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-10 pb-14 sm:pt-12 sm:pb-16 md:pt-14 md:pb-18 border-t border-border">
        <div className="mb-8 sm:mb-9 md:mb-10">
          <div className="mb-5 sm:mb-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
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

      {/* ── App Screens ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-16">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold mb-3">
            {t("screensEyebrow")}
          </p>
          <h2 className="font-display font-semibold text-[clamp(1.4rem,3vw,1.875rem)] leading-tight tracking-tight text-text-primary">
            {t("screensTitle")}
          </h2>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.08fr_1fr] gap-4 md:gap-5 items-start">
          {/* Panel 1 — Dashboard list */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-bg-card px-1.5 text-[10px] font-semibold tabular-nums text-text-muted">01</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t("screenDashboardTitle")}</span>
            </div>
            <div
              className="border border-border rounded-xl overflow-hidden bg-bg-card"
              style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em]">
                  {t("screenDashboardTitle")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-green-500 animate-[operational-badge-dot_2.6s_ease-in-out_infinite] inline-block" />
                  <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">{t("screenDashboardBadge")}</span>
                </span>
              </div>
              <div className="px-3 py-3 border-b border-border/80 bg-gradient-to-b from-muted/35 to-transparent dark:from-muted/20">
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-md border border-border/80 bg-muted/35 dark:bg-muted/20 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{tDash("statLabelTotal")}</p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-text-primary">5</p>
                  </div>
                  <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] dark:bg-emerald-500/10 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">{tDash("statLabelUp")}</p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">4</p>
                  </div>
                  <div className="rounded-md border border-red-500/25 bg-red-500/[0.06] dark:bg-red-500/10 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold">{tDash("statLabelDown")}</p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-red-700 dark:text-red-400">1</p>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-2.5">
                {[
                  { name: "api.production",  url: "api.example.com",  up: true,  uptime: "100", ms: "112ms" },
                  { name: "auth.service",    url: "auth.example.com", up: false, uptime: "97",  ms: "—" },
                  { name: "cdn.assets",      url: "cdn.example.com",  up: true,  uptime: "99",  ms: "14ms" },
                ].map((m) => (
                  <div key={m.name} className="rounded-lg border border-border bg-bg-card px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-4 items-center justify-center rounded bg-border text-[10px] text-text-muted">
                        •
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-medium text-text-primary truncate">{m.name}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            m.up
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            <span className={`size-1 rounded-full ${m.up ? "bg-emerald-500" : "bg-red-500"}`} />
                            {m.up ? tDetail("statusUp") : tDetail("statusDown")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-text-muted truncate">{m.url}</p>
                        <div className="mt-2 flex items-center gap-px h-1.5">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <span
                              key={`${m.name}-${i}`}
                              className={`flex-1 rounded-[1px] ${m.up || i < 16 ? "bg-emerald-500/55" : "bg-red-500/55"}`}
                            />
                          ))}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-muted tabular-nums">
                          <span>{m.uptime}%</span>
                          <span>{m.ms}</span>
                          <span>{tTime("minutesAgo", { count: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border bg-bg-elevated/60">
                <span className="text-[10px] text-text-muted">{t("screenDashboardStat")}</span>
              </div>
            </div>
          </div>

          {/* Panel 2 — Monitor detail */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-bg-card px-1.5 text-[10px] font-semibold tabular-nums text-text-muted">02</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t("screenDashboardTitle")} &rarr; auth.service</span>
            </div>
            <div
              className="border border-border rounded-xl overflow-hidden bg-bg-card"
              style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
            >
            <div className="px-4 py-2.5 border-b border-border/80 bg-muted/30 dark:bg-muted/20">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{tDetail("heroEyebrow")}</span>
            </div>
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-display text-[13px] font-semibold text-text-primary">auth.service</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  {t("mockStatusDown")}
                </span>
              </div>
              <p className="text-[10px] text-text-muted">https://auth.example.com/health</p>
            </div>
            <div className="px-4 pt-2 pb-2 border-b border-border">
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">GET</span>
                <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{tDetail("configEvery", { n: 1 })}</span>
                <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{tDetail("configTimeout", { n: 10 })}</span>
                <span className="inline-flex items-center rounded-full border border-border bg-bg-page px-2 py-0.5 text-[9px] font-medium text-text-muted">{tDetail("configSslOn")}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/25 dark:bg-muted/15">
              {([
                { label: t("mockUptimeLabel"),    value: "97.4%", color: "text-yellow-600 dark:text-yellow-400" },
                { label: t("mockAvgLabel"),       value: "1.2 s", color: "text-text-primary" },
                { label: t("mockIncidentsLabel"), value: "3",     color: "text-red-600 dark:text-red-400" },
                { label: t("mockSslLabel"),       value: "✓",     color: "text-green-600 dark:text-green-400" },
              ] as const).map((s) => (
                <div key={s.label} className="px-2 py-3 text-center">
                  <p className={`text-[14px] font-semibold tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] text-text-muted uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-b border-border bg-gradient-to-b from-muted/35 to-transparent dark:from-muted/20">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{tDetail("checkLogTitle")}</span>
            </div>
            <div className="px-4 py-2 border-b border-border grid grid-cols-[1fr_auto_auto] gap-3">
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColTime")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColCode")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold text-right">{t("mockColResponse")}</span>
            </div>
            <div className="divide-y divide-border">
              {mockDetailRows.map((row) => (
                <div key={row.time} className="px-4 py-2 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <span className="text-[11px] text-text-primary tabular-nums">{row.time}</span>
                  <span className={`text-[11px] tabular-nums font-medium ${row.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{row.code}</span>
                  <span className="text-[10px] text-text-muted tabular-nums text-right">{row.ms}</span>
                </div>
              ))}
            </div>
            </div>
          </div>

          {/* Panel 3 — Activity feed */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-bg-card px-1.5 text-[10px] font-semibold tabular-nums text-text-muted">03</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{t("screenActivityTitle")}</span>
            </div>
            <div
              className="border border-border rounded-xl overflow-hidden bg-bg-card"
              style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
            >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em] block">
                  {t("screenActivityTitle")}
                </span>
                <span className="text-[10px] text-text-muted">{tActivity("eventCount", { count: 8 })}</span>
              </div>
              <span className="text-[11px] text-text-muted tabular-nums">{t("screenActivityCount")}</span>
            </div>
            <div className="divide-y divide-border">
              {mockActivityRows.map((row) => (
                <div key={`${row.name}-${row.when}`} className="px-4 py-3 flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      row.down
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}
                    aria-hidden
                  >
                    {row.down ? "↓" : "✓"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                        row.down
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {row.down ? t("mockWentDown") : t("mockRecovered")}
                      </span>
                      <span className="text-[11px] font-medium text-text-primary truncate">{row.name}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-text-muted truncate">{row.name}.example.com</p>
                    <p className="mt-1 text-[10px] text-text-muted tabular-nums">{row.when}</p>
                  </div>
                  <span className="text-text-muted text-xs leading-none">×</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border bg-bg-elevated/60">
              <span className="text-[10px] text-text-muted">{t("screenActivityFooter")}</span>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-14 pb-12 sm:pt-16 sm:pb-14 border-t border-border">
        <div className="mb-7 sm:mb-8">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {([
            { step: "01", title: t("feature1Title"), body: t("feature1Body") },
            { step: "02", title: t("feature2Title"), body: t("feature2Body") },
            { step: "03", title: t("feature3Title"), body: t("feature3Body") },
            { step: "04", title: t("feature4Title"), body: t("feature4Body") },
          ] as const).map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-bg-card/60 p-4 sm:p-5">
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

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border px-6 py-6 sm:py-7">
        <div className="max-w-6xl mx-auto mb-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
        </div>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-xs text-text-muted">
            <HeartPulse className="size-3.5 shrink-0" />
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
