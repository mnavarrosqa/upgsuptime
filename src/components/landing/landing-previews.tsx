import type { ReactNode } from "react";
import { Activity, Bell, Check, LayoutGrid, Monitor, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Static, code-built previews of the real product for the landing page. They
 * reuse the app's own strings and status colours so they read as the product,
 * and all tell one story: "API de pagos" is down.
 */

export type PreviewMonitor = {
  name: string;
  /** One character per day, oldest first: u = up, w = some failures, d = down. */
  strip: string;
  uptime: string;
  status: "up" | "down";
  /** "112 ms" for up monitors, "Caído · 4 min" for the down one. */
  statusText: string;
  detail?: string;
};

function Strip({ strip, className }: { strip: string; className?: string }) {
  return (
    <div className={cn("flex h-5 gap-[2px]", className)} aria-hidden>
      {strip.split("").map((s, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[2px]",
            s === "u" && "bg-status-up/80",
            s === "w" && "bg-status-warn/80",
            s === "d" && "bg-status-down",
            s === "-" && "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: "up" | "down" }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", status === "up" ? "bg-status-up" : "bg-status-down")}
    />
  );
}

/** The dashboard as a window: the hero's product view. */
export function DashboardWindow({
  address,
  nav,
  headline,
  meta,
  stats,
  monitors,
}: {
  address: string;
  nav: { dashboard: string; monitors: string; activity: string };
  headline: string;
  meta: string;
  stats: { label: string; value: string }[];
  monitors: PreviewMonitor[];
}) {
  const navItems = [
    { label: nav.dashboard, Icon: LayoutGrid, active: true },
    { label: nav.monitors, Icon: Monitor, active: false },
    { label: nav.activity, Icon: Bell, active: false },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-none">
      <div className="flex h-10 items-center gap-3 border-b border-border px-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="mx-auto rounded-md bg-bg-page px-3 py-1 text-xs text-text-muted">{address}</span>
        <span className="w-[42px]" aria-hidden />
      </div>
      <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-bg-page/60 p-3 md:block">
          <div className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-text-primary">
            <BrandMark className="size-5 shrink-0" />
            UPG Monitor
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            {navItems.map(({ label, Icon, active }) => (
              <span
                key={label}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium",
                  active ? "bg-accent/10 text-accent" : "text-text-muted",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </aside>
        <div className="min-w-0 p-5 sm:p-6">
          <p className="flex items-center gap-2.5 font-display text-2xl font-medium tracking-tight text-status-down sm:text-3xl">
            <span aria-hidden className="size-2 rounded-full bg-status-down" />
            {headline}
          </p>
          <p className="mt-2 text-sm text-text-muted">{meta}</p>
          <dl className="mt-5 grid grid-cols-2 border-y border-border py-4 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "min-w-0 px-3 first:pl-0",
                  i % 2 === 1 && "border-l border-border",
                  i >= 2 && "mt-4 border-t pt-4 lg:mt-0 lg:border-t-0 lg:pt-0",
                  i === 2 && "pl-0 lg:border-l lg:pl-3",
                )}
              >
                <dt className="min-h-8 text-xs leading-4 text-text-muted lg:min-h-0">{s.label}</dt>
                <dd className="mt-1.5 text-lg font-medium tabular-nums tracking-tight text-text-primary">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {monitors.map((m, i) => (
              <div
                key={m.name}
                className={cn(
                  "rounded-xl border bg-bg-card p-3.5",
                  m.status === "down" ? "border-status-down/40" : "border-border",
                  // Fewer cards on small screens: a preview gets simpler, not smaller.
                  i >= 3 && "hidden lg:block",
                )}
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={m.status} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{m.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      m.status === "down" ? "font-medium text-status-down" : "text-text-muted",
                    )}
                  >
                    {m.statusText}
                  </span>
                </div>
                <Strip strip={m.strip} className="mt-3" />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-muted">
                  <span className="truncate">{m.detail ?? ""}</span>
                  <span className="shrink-0 tabular-nums">{m.uptime} · 90d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The new-monitor form, reduced to what step one is about. */
export function MonitorSetupPreview({
  title,
  urlLabel,
  url,
  typeLabel,
  types,
  intervalLabel,
  interval,
  ssl,
  save,
}: {
  title: string;
  urlLabel: string;
  url: string;
  typeLabel: string;
  types: string[];
  intervalLabel: string;
  interval: string;
  ssl: string;
  save: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <div className="mt-4 space-y-4">
        <Field label={urlLabel}>
          <span className="block truncate rounded-lg border border-border bg-bg-page px-3 py-2 text-[13px] text-text-primary">
            {url}
          </span>
        </Field>
        <Field label={typeLabel}>
          <span className="flex flex-wrap gap-1.5">
            {types.map((type, i) => (
              <span
                key={type}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs",
                  i === 0 ? "border-text-primary/30 bg-bg-page font-medium text-text-primary" : "border-border text-text-muted",
                )}
              >
                {type}
              </span>
            ))}
          </span>
        </Field>
        <Field label={intervalLabel}>
          <span className="inline-block rounded-lg border border-border bg-bg-page px-3 py-2 text-[13px] text-text-primary">
            {interval}
          </span>
        </Field>
        <span className="flex items-center gap-2.5 text-[13px] text-text-primary">
          <span className="flex size-4 items-center justify-center rounded bg-accent text-bg-page" aria-hidden>
            <Check className="size-3" strokeWidth={2.5} />
          </span>
          {ssl}
        </span>
      </div>
      <span className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-medium text-bg-page">
        {save}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-text-muted">{label}</p>
      {children}
    </div>
  );
}

/** The down alert as it lands, mirroring src/lib/email-templates.ts. */
export function AlertEmailPreview({
  inbox,
  when,
  badge,
  headline,
  url,
  ackButton,
  viewButton,
  rows,
}: {
  inbox: string;
  when: string;
  badge: string;
  headline: ReactNode;
  url: string;
  ackButton: string;
  viewButton: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-page p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 px-1 pb-3 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <BrandMark className="size-4 shrink-0" />
          {inbox} · UPG Monitor
        </span>
        <span className="tabular-nums">{when}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border border-t-[3px] border-t-status-down bg-bg-card p-5 sm:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-down/10 px-2.5 py-1 text-xs font-medium text-status-down">
          <X className="size-3" strokeWidth={2.5} aria-hidden />
          {badge}
        </span>
        <p className="mt-4 text-lg leading-snug text-text-primary">{headline}</p>
        <p className="mt-1 truncate text-sm text-text-muted">{url}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center rounded-lg bg-status-down px-4 text-[13px] font-medium text-status-down-fg">
            {ackButton}
          </span>
          <span className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-[13px] font-medium text-text-primary">
            {viewButton}
          </span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-bg-page p-4 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-xs text-text-muted">{r.label}</dt>
              <dd className="mt-1 truncate text-sm tabular-nums text-text-primary">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** A public status page with the same outage. */
export function StatusPagePreview({
  company,
  title,
  servicesHeading,
  services,
}: {
  company: string;
  title: string;
  servicesHeading: string;
  services: { name: string; up: boolean; label: string; strip: string; uptime: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
      <p className="text-xs text-text-muted">{company}</p>
      <p className="mt-1 flex items-center gap-2 font-display text-lg font-medium text-text-primary">
        <Activity className="size-4 text-text-muted" aria-hidden />
        {title}
      </p>
      <p className="mt-5 text-xs text-text-muted">{servicesHeading}</p>
      <ul className="mt-2 divide-y divide-border">
        {services.map((s) => (
          <li key={s.name} className="py-3">
            <div className="flex items-center gap-2">
              <StatusDot status={s.up ? "up" : "down"} />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{s.name}</span>
              <span className={cn("shrink-0 text-xs", s.up ? "text-text-muted" : "font-medium text-status-down")}>
                {s.label}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Strip strip={s.strip} className="h-4 flex-1" />
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-muted">{s.uptime}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
