"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import type { Monitor } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { MonitorFavicon } from "@/components/monitor-favicon";
import { MonitorStatusBadge } from "@/components/monitor-status-badge";
import { SslBadge } from "@/components/ssl-badge";
import { SortableTableHeader } from "@/components/sortable-table-header";
import { DowntimeAckBadge } from "@/components/downtime-ack-controls";
import { isDowntimeAcked } from "@/lib/downtime-ack";
import type { LatestByMonitor } from "@/lib/sort-monitors";
import { cn } from "@/lib/utils";

type SortBy = { field: string; direction: "asc" | "desc" };

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `/api/favicon?domain=${host}`;
  } catch {
    return "";
  }
}

function formatLastChecked(
  date: Date | null,
  tTime: (key: string, values?: Record<string, number>) => string
): string {
  if (!date) return tTime("never");
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return tTime("justNow");
  if (diffMin < 60) return tTime("minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return tTime("hoursAgo", { count: diffHr });
  return tTime("daysAgo", { count: Math.floor(diffHr / 24) });
}

function RowActionsMenu({
  monitor,
  isPausing,
  onEdit,
  onPause,
  onDelete,
}: {
  monitor: Monitor;
  isPausing: boolean;
  onEdit: (id: string) => void;
  onPause: (id: string, currentlyPaused: boolean) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const t = useTranslations("monitorsPage");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleOpen() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={t("actions")}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 w-40 overflow-hidden rounded-lg border border-border bg-bg-card shadow-lg"
        >
          <Link
            href={`/monitors/${monitor.id}`}
            role="menuitem"
            className="flex w-full items-center px-3.5 py-2 text-sm text-text-primary transition hover:bg-bg-page active:scale-[0.98]"
            onClick={() => setOpen(false)}
          >
            {t("view")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit(monitor.id);
            }}
            className="h-auto w-full justify-start rounded-none border-0 px-3.5 py-2 text-sm font-normal text-text-primary shadow-none hover:bg-bg-page active:scale-[0.98]"
          >
            {t("edit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            disabled={isPausing}
            onClick={() => {
              setOpen(false);
              onPause(monitor.id, !!monitor.paused);
            }}
            className="h-auto w-full justify-start rounded-none border-0 px-3.5 py-2 text-sm font-normal text-text-primary shadow-none hover:bg-bg-page active:scale-[0.98]"
          >
            {isPausing
              ? monitor.paused
                ? t("resuming")
                : t("pausing")
              : monitor.paused
                ? t("resume")
                : t("pause")}
          </Button>
          <div className="my-1 border-t border-border" role="separator" />
          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete(monitor.id, monitor.name);
            }}
            className="h-auto w-full justify-start rounded-none border-0 px-3.5 py-2 text-sm font-normal text-red-600 shadow-none hover:bg-red-50 active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {t("delete")}
          </Button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleOpen}
        className="h-11 w-11 rounded-md text-text-muted hover:bg-bg-page hover:text-text-primary active:scale-90"
        aria-label={t("actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </Button>
      {menu}
    </>
  );
}

function MonitorsMobileList({
  monitors,
  latestByMonitor,
  selectedIds,
  allVisibleSelected,
  onToggleSelected,
  onToggleSelectAllVisible,
  pausingId,
  onEdit,
  onPause,
  onDelete,
}: MonitorsListViewProps) {
  const t = useTranslations("monitorsPage");
  const tTime = useTranslations("time");

  return (
    <div className="sm:hidden">
      <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-4 py-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-text-primary">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={onToggleSelectAllVisible}
            className="ui-checkbox"
          />
          {t("selectAllAria")}
        </label>
        <span className="text-xs text-text-muted">{t("totalCount", { count: monitors.length })}</span>
      </div>
      <div className="divide-y divide-border">
        {monitors.map((m) => {
          const latest = latestByMonitor[m.id];
          const favicon = getFaviconUrl(m.url);
          return (
            <article
              key={m.id}
              className={cn("p-4", m.paused && "bg-muted/15 opacity-80")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => onToggleSelected(m.id)}
                  className="ui-checkbox mt-3"
                  aria-label={t("selectMonitorAria", { name: m.name })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MonitorFavicon src={favicon} />
                      <Link
                        href={`/monitors/${m.id}`}
                        className="min-w-0 truncate font-medium text-text-primary underline-offset-2 hover:text-text-muted hover:underline"
                        title={m.name}
                      >
                        {m.name}
                      </Link>
                    </div>
                    <RowActionsMenu
                      monitor={m}
                      isPausing={pausingId === m.id}
                      onEdit={onEdit}
                      onPause={onPause}
                      onDelete={onDelete}
                    />
                  </div>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                  >
                    {m.url}
                  </a>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <MonitorStatusBadge paused={m.paused} latest={latest} />
                    {isDowntimeAcked(m) ? <DowntimeAckBadge /> : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/70 bg-bg-page px-2.5 py-2">
                      <dt className="font-medium text-text-muted">{t("colLastChecked")}</dt>
                      <dd className="mt-1 text-text-primary">{formatLastChecked(m.lastCheckAt, tTime)}</dd>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-bg-page px-2.5 py-2">
                      <dt className="font-medium text-text-muted">{t("colInterval")}</dt>
                      <dd className="mt-1 text-text-primary">
                        {t("everyMinutes", { count: m.intervalMinutes })}
                      </dd>
                    </div>
                    <div className="col-span-2 rounded-lg border border-border/70 bg-bg-page px-2.5 py-2">
                      <dt className="font-medium text-text-muted">{t("colSsl")}</dt>
                      <dd className="mt-1">
                        <SslBadge
                          monitoring={!!m.sslMonitoring}
                          valid={m.sslValid ?? null}
                          expiresAt={m.sslExpiresAt ?? null}
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MonitorsDesktopTable({
  monitors,
  latestByMonitor,
  selectedIds,
  headerSelectRef,
  allVisibleSelected,
  sortBy,
  onSortChange,
  onToggleSelected,
  onToggleSelectAllVisible,
  pausingId,
  onEdit,
  onPause,
  onDelete,
}: MonitorsListViewProps) {
  const t = useTranslations("monitorsPage");
  const tTime = useTranslations("time");

  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full table-fixed divide-y divide-border">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead>
          <tr className="bg-muted/30 dark:bg-muted/15">
            <th className="w-10 px-3 py-2.5 text-center align-middle">
              <input
                ref={headerSelectRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onToggleSelectAllVisible}
                className="ui-checkbox mx-auto"
                aria-label={t("selectAllAria")}
              />
            </th>
            <SortableTableHeader
              column="name"
              label={t("colMonitor")}
              currentSort={sortBy}
              onSort={onSortChange}
            />
            <SortableTableHeader
              column="url"
              label={t("colUrl")}
              currentSort={sortBy}
              onSort={onSortChange}
              className="hidden sm:table-cell"
            />
            <SortableTableHeader
              column="status"
              label={t("colStatus")}
              currentSort={sortBy}
              onSort={onSortChange}
            />
            <SortableTableHeader
              column="ssl"
              label={t("colSsl")}
              currentSort={sortBy}
              onSort={onSortChange}
              className="hidden sm:table-cell"
            />
            <SortableTableHeader
              column="lastCheckAt"
              label={t("colLastChecked")}
              currentSort={sortBy}
              onSort={onSortChange}
              className="hidden md:table-cell"
            />
            <th
              className="sticky right-0 z-[2] w-[9rem] bg-muted/30 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted dark:bg-muted/15 md:px-4"
              scope="col"
            >
              {t("colActions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {monitors.map((m) => {
            const favicon = getFaviconUrl(m.url);
            const latest = latestByMonitor[m.id];
            return (
              <tr
                key={m.id}
                className={cn("group", m.paused ? "opacity-60 hover:opacity-80" : "hover:bg-bg-page")}
              >
                <td className="w-10 px-3 py-3 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => onToggleSelected(m.id)}
                    className="ui-checkbox mx-auto"
                    aria-label={t("selectMonitorAria", { name: m.name })}
                  />
                </td>
                <td className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MonitorFavicon src={favicon} />
                    <Link
                      href={`/monitors/${m.id}`}
                      className="min-w-0 truncate font-medium text-text-primary transition active:scale-95 hover:text-text-muted"
                      title={m.name}
                    >
                      {m.name}
                    </Link>
                  </div>
                  <p className="mt-0.5 hidden truncate text-xs text-text-muted sm:max-md:block">
                    {formatLastChecked(m.lastCheckAt, tTime)} · {t("everyMinutes", { count: m.intervalMinutes })}
                  </p>
                </td>
                <td className="hidden min-w-0 px-4 py-3 text-sm sm:table-cell">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                  >
                    {m.url}
                  </a>
                </td>
                <td className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <MonitorStatusBadge paused={m.paused} latest={latest} />
                    {isDowntimeAcked(m) ? <DowntimeAckBadge /> : null}
                  </div>
                </td>
                <td className="hidden min-w-0 px-4 py-3 sm:table-cell">
                  <SslBadge
                    monitoring={!!m.sslMonitoring}
                    valid={m.sslValid ?? null}
                    expiresAt={m.sslExpiresAt ?? null}
                  />
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-sm text-text-muted md:table-cell md:px-4">
                  {formatLastChecked(m.lastCheckAt, tTime)}
                </td>
                <td className="sticky right-0 z-[1] w-[9rem] bg-bg-card px-3 py-3 text-right align-top group-hover:bg-bg-page md:px-4">
                  <RowActionsMenu
                    monitor={m}
                    isPausing={pausingId === m.id}
                    onEdit={onEdit}
                    onPause={onPause}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type MonitorsListViewProps = {
  monitors: Monitor[];
  latestByMonitor: LatestByMonitor;
  selectedIds: Set<string>;
  headerSelectRef: RefObject<HTMLInputElement | null>;
  allVisibleSelected: boolean;
  sortBy: SortBy;
  onSortChange: (field: string) => void;
  onToggleSelected: (id: string) => void;
  onToggleSelectAllVisible: () => void;
  pausingId: string | null;
  onEdit: (id: string) => void;
  onPause: (id: string, currentlyPaused: boolean) => void;
  onDelete: (id: string, name: string) => void;
};

export function MonitorsListView(props: MonitorsListViewProps) {
  const t = useTranslations("monitorsPage");

  return (
    <div className="mt-6 w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="border-b border-border/80 bg-gradient-to-b from-muted/40 to-transparent px-4 py-2.5 dark:from-muted/25 sm:px-5 sm:py-3">
        <h2
          className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("tableSectionHeading")}
        </h2>
      </div>
      <MonitorsMobileList {...props} />
      <MonitorsDesktopTable {...props} />
    </div>
  );
}
