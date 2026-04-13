/** Primary app routes shown in the top nav (Dashboard, Monitors, Activity). */
export const APP_PRIMARY_NAV_LINKS = [
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/monitors", labelKey: "monitors" as const },
  { href: "/activity", labelKey: "activity" as const },
] as const;

export function isPrimaryNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export function isAdminNavActive(pathname: string): boolean {
  return pathname.startsWith("/admin");
}
