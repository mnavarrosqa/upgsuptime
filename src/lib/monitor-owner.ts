import type { AppLocale } from "@/i18n/config";
import { normalizeLocale } from "@/i18n/config";

/** Account that owns a monitor — used for alert email delivery and language. */
export type MonitorOwner = {
  email: string;
  language: AppLocale;
};

export function monitorOwnerFromUser(user: {
  email?: string | null;
  language?: string | null;
}): MonitorOwner {
  return {
    email: user.email?.trim() ?? "",
    language: normalizeLocale(user.language),
  };
}
