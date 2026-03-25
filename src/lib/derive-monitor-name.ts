import { MAX_NAME_LENGTH } from "@/lib/validate-monitor";

/** Hostname from URL, or a trimmed fallback suitable for monitor name. */
export function deriveMonitorNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.length > MAX_NAME_LENGTH) {
      return hostname.slice(0, MAX_NAME_LENGTH);
    }
    return hostname;
  } catch {
    const t = url.trim();
    if (t.length > MAX_NAME_LENGTH) {
      return t.slice(0, MAX_NAME_LENGTH);
    }
    return t || "Monitor";
  }
}
