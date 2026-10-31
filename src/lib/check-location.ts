/**
 * Label for where uptime checks run.
 * Priority: CHECKS_LOCATION env → geo-IP lookup (cached) → TZ city.
 */

const GEO_CACHE: { label: string | null; fetched: boolean } = {
  label: null,
  fetched: false,
};

const isIpAddress = (input: string) =>
  /^(?:\d{1,3}\.){3}\d{1,3}$/.test(input) || /^\[?[A-Fa-f0-9:]+\]?$/.test(input);

function fromEnv(): string | null {
  const value = (
    process.env.CHECKS_LOCATION ?? process.env.NEXT_PUBLIC_CHECKS_LOCATION
  )?.trim();
  return value && !isIpAddress(value) ? value : null;
}

function fromTz(): string | null {
  const tz = process.env.TZ?.trim();
  if (!tz) return null;
  if (tz.toUpperCase() === "UTC" || tz === "Etc/UTC") return "UTC";
  const zoneName = tz.split("/").at(-1)?.replaceAll("_", " ");
  if (!zoneName || isIpAddress(zoneName)) return null;
  return zoneName;
}

async function fetchGeoLocation(): Promise<string | null> {
  if (GEO_CACHE.fetched) return GEO_CACHE.label;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("http://ip-api.com/json/?fields=city,country,status", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      city?: string;
      country?: string;
    };
    if (data.status !== "success" || !data.city) return null;
    GEO_CACHE.label = `${data.city}, ${data.country}`;
  } catch {
    // Network error — fall through to TZ
  } finally {
    GEO_CACHE.fetched = true;
  }
  return GEO_CACHE.label;
}

export async function getCheckLocationLabel(): Promise<string | null> {
  const env = fromEnv();
  if (env) return env;
  const geo = await fetchGeoLocation();
  if (geo) return geo;
  return fromTz();
}
