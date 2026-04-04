import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const [[row], session, t, tCommon] = await Promise.all([
    db.select({ count: count() }).from(user),
    getServerSession(authOptions),
    getTranslations("landing"),
    getTranslations("common"),
  ]);

  if (row.count === 0) redirect("/setup");
  if (session) redirect("/dashboard");
  const upCount = MOCK_MONITORS.filter((m) => m.status).length;

  return (
    <main className="min-h-screen bg-bg-page text-text-primary flex flex-col">
      {/* ── Header ── */}
      <header className="max-w-6xl mx-auto w-full px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-[18px] rounded-full bg-accent inline-block flex-shrink-0" />
          <span className="font-display font-semibold text-[15px] tracking-tight">UPG Monitor</span>
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
      <section className="max-w-6xl mx-auto w-full px-6 pt-16 pb-20 grid lg:grid-cols-[1fr_460px] gap-12 xl:gap-20 items-start">
        {/* Copy */}
        <div className="flex flex-col gap-6 lg:pt-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold">
            {t("eyebrow")}
          </p>
          <h1 className="font-display font-semibold text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.06] tracking-tight text-text-primary">
            {t("headlinePart1")}<br />
            {t("headlinePart2")}
          </h1>
          <p className="text-[clamp(0.9375rem,2vw,1.0625rem)] text-text-muted leading-[1.65] max-w-[380px]">
            {t("subheadline")}
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center px-5 py-2.5 bg-accent text-bg-page text-sm font-semibold rounded-lg hover:bg-accent-hover transition-colors duration-150"
            >
              {t("cta")}
            </Link>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {([t("bullet1"), t("bullet2"), t("bullet3")] as const).map((label) => (
              <li key={label} className="flex items-center gap-2 text-[12px] text-text-muted">
                <span className="size-1 rounded-full bg-text-muted/35 inline-block flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Status panel */}
        <div
          className="border border-border rounded-xl overflow-hidden bg-bg-card"
          style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em]">
              {t("panelTitle")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500 animate-[operational-badge-dot_2.6s_ease-in-out_infinite] inline-block" />
              <span className="text-[11px] text-text-muted tabular-nums">{t("panelStatus", { up: upCount, total: MOCK_MONITORS.length })}</span>
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {MOCK_MONITORS.map((m) => (
              <div key={m.name} className="px-4 py-3.5 flex items-center gap-3">
                {/* Status dot */}
                <div className="relative flex-shrink-0 size-2">
                  <span
                    className={`size-2 rounded-full absolute inset-0 ${
                      m.status ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  {m.status && (
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-[monitor-status-ring_1.85s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  )}
                </div>

                {/* Name + bar chart */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[13px] font-medium text-text-primary truncate">{m.name}</span>
                    <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0">{m.ms}</span>
                  </div>
                  <div className="flex items-end gap-px h-2.5">
                    {m.bars.split("").map((b, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-[1px] transition-none ${
                          b === "1" ? "bg-green-500/60" : "bg-red-500/60"
                        }`}
                        style={{ height: b === "1" ? "100%" : "55%" }}
                      />
                    ))}
                  </div>
                </div>

                {/* Uptime */}
                <span
                  className={`text-[12px] font-semibold tabular-nums flex-shrink-0 ${
                    m.status ? "text-text-muted" : "text-red-500"
                  }`}
                >
                  {m.uptime}%
                </span>
              </div>
            ))}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2.5 border-t border-border bg-bg-elevated/60">
            <span className="text-[11px] text-text-muted">{t("panelFooter")}</span>
          </div>
        </div>
      </section>

      {/* ── Why it matters ── */}
      <section className="max-w-6xl mx-auto w-full px-6 py-16 border-t border-border">
        <div className="mb-10">
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
            <div key={item.num} className="py-6 grid md:grid-cols-[2rem_1fr_2fr] gap-3 md:gap-10 items-baseline">
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

        <div className="grid lg:grid-cols-3 gap-4 items-start">
          {/* Panel 1 — Dashboard list */}
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
            <div className="divide-y divide-border">
              {[
                { name: "api.production",  url: "api.example.com",  up: true,  uptime: "99.97", ms: "112 ms" },
                { name: "app.production",  url: "app.example.com",  up: true,  uptime: "99.81", ms: "88 ms"  },
                { name: "auth.service",    url: "auth.example.com", up: false, uptime: "97.40", ms: "—"      },
                { name: "cdn.assets",      url: "cdn.example.com",  up: true,  uptime: "100.0", ms: "14 ms"  },
                { name: "db.replica",      url: "db.example.com",   up: true,  uptime: "99.92", ms: "31 ms"  },
              ].map((m) => (
                <div key={m.name} className="px-4 py-2.5 flex items-center gap-2.5">
                  <span className={`size-[7px] rounded-full flex-shrink-0 ${m.up ? "bg-green-500" : "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-text-primary truncate">{m.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{m.url}</p>
                  </div>
                  <span className={`text-[11px] tabular-nums font-medium flex-shrink-0 ${m.up ? "text-text-muted" : "text-red-500 dark:text-red-400"}`}>
                    {m.uptime}%
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums flex-shrink-0 w-10 text-right">{m.ms}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border bg-bg-elevated/60">
              <span className="text-[10px] text-text-muted">{t("screenDashboardStat")}</span>
            </div>
          </div>

          {/* Panel 2 — Monitor detail */}
          <div
            className="border border-border rounded-xl overflow-hidden bg-bg-card"
            style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
          >
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
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
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
            <div className="px-4 py-2 border-b border-border grid grid-cols-[1fr_auto_auto] gap-3">
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColTime")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColCode")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold text-right">{t("mockColResponse")}</span>
            </div>
            <div className="divide-y divide-border">
              {[
                { time: "10:23 PM", code: "503", ms: "1245 ms", ok: false },
                { time: "10:21 PM", code: "503", ms: "987 ms",  ok: false },
                { time: "10:18 PM", code: "0",   ms: "—",       ok: false },
                { time: "09:41 PM", code: "503", ms: "1102 ms", ok: false },
                { time: "08:55 PM", code: "200", ms: "108 ms",  ok: true  },
              ].map((row) => (
                <div key={row.time} className="px-4 py-2 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <span className="text-[11px] text-text-primary tabular-nums">{row.time}</span>
                  <span className={`text-[11px] tabular-nums font-medium ${row.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{row.code}</span>
                  <span className="text-[10px] text-text-muted tabular-nums text-right">{row.ms}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3 — Activity feed */}
          <div
            className="border border-border rounded-xl overflow-hidden bg-bg-card"
            style={{ boxShadow: "0 1px 4px 0 oklch(0 0 0 / 0.06), 0 4px 16px -4px oklch(0 0 0 / 0.06)" }}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.12em]">
                {t("screenActivityTitle")}
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">{t("screenActivityCount")}</span>
            </div>
            <div className="px-4 py-2 border-b border-border grid grid-cols-[1fr_auto_auto] gap-3">
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColMonitor")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{t("mockColEvent")}</span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold text-right">{t("mockColWhen")}</span>
            </div>
            <div className="divide-y divide-border">
              {[
                { name: "api.production", down: false, when: "2m"  },
                { name: "auth.service",   down: true,  when: "14m" },
                { name: "app.production", down: false, when: "1h"  },
                { name: "auth.service",   down: true,  when: "1h"  },
                { name: "cdn.assets",     down: false, when: "3h"  },
                { name: "db.replica",     down: false, when: "5h"  },
              ].map((row) => (
                <div key={`${row.name}-${row.when}`} className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <span className="text-[12px] font-medium text-text-primary truncate">{row.name}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${
                    row.down
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  }`}>
                    <span className={`size-1 rounded-full flex-shrink-0 ${row.down ? "bg-red-500" : "bg-emerald-500"}`} />
                    {row.down ? t("mockWentDown") : t("mockRecovered")}
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums text-right flex-shrink-0">{row.when}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border bg-bg-elevated/60">
              <span className="text-[10px] text-text-muted">{t("screenActivityFooter")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto w-full px-6 py-16 border-t border-border">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-12">
          {([
            { title: t("feature1Title"), body: t("feature1Body") },
            { title: t("feature2Title"), body: t("feature2Body") },
            { title: t("feature3Title"), body: t("feature3Body") },
            { title: t("feature4Title"), body: t("feature4Body") },
          ] as const).map((f) => (
            <div key={f.title}>
              <h3 className="font-display font-semibold text-text-primary mb-2.5">
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
      <footer className="mt-auto border-t border-border px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xs text-text-muted">UPG Monitor</span>
          <Link
            href="/login"
            className="text-xs text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            {tCommon("signIn")} →
          </Link>
        </div>
      </footer>
    </main>
  );
}
