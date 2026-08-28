/** Label for where uptime checks run (env overlay, else TZ city). */
export function getCheckLocationLabel(): string | null {
  const explicitLocation =
    process.env.CHECKS_LOCATION ?? process.env.NEXT_PUBLIC_CHECKS_LOCATION;
  const value = explicitLocation?.trim();
  const isIpAddress = (input: string) =>
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(input) || /^\[?[A-Fa-f0-9:]+\]?$/.test(input);
  if (value && !isIpAddress(value)) return value;

  const tz = process.env.TZ?.trim();
  if (!tz) return null;
  if (tz.toUpperCase() === "UTC" || tz === "Etc/UTC") return "UTC";
  const zoneName = tz.split("/").at(-1)?.replaceAll("_", " ");
  if (!zoneName || isIpAddress(zoneName)) return null;
  return zoneName;
}
