/** Primary app routes shown in the top nav (Dashboard, Activity). */
export const APP_PRIMARY_NAV_LINKS = [
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/activity", labelKey: "activity" as const },
] as const;

export function isPrimaryNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/monitors/");
  }
  return pathname.startsWith(href);
}

export function isAdminNavActive(pathname: string): boolean {
  return pathname.startsWith("/admin");
}
