/** Primary app routes in the sidebar (Dashboard, Monitors, Activity). */
export const APP_PRIMARY_NAV_LINKS = [
  { href: "/dashboard", labelKey: "dashboard" as const },
  { href: "/monitors", labelKey: "monitors" as const },
  { href: "/activity", labelKey: "activity" as const },
] as const;

export const APP_ADMIN_NAV_LINKS = [
  { href: "/admin", labelKey: "overview" as const, exact: true },
  { href: "/admin/users", labelKey: "users" as const, exact: false },
  { href: "/admin/monitors", labelKey: "monitors" as const, exact: false },
  { href: "/admin/settings", labelKey: "settings" as const, exact: false },
] as const;

export function isPrimaryNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/monitors") {
    return pathname === "/monitors" || pathname.startsWith("/monitors/");
  }
  return pathname.startsWith(href);
}

export function isAdminChildActive(
  pathname: string,
  href: string,
  exact: boolean
): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}
