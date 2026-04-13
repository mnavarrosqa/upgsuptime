export const LOCALES = ["en", "es"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
/** Stable default for formatting dates/times (avoids ENVIRONMENT_FALLBACK / SSR mismatches). */
export const DEFAULT_TIME_ZONE = "UTC";
export const LOCALE_COOKIE = "UPGS_LOCALE";

export function isAppLocale(value: string): value is AppLocale {
  return LOCALES.includes(value as AppLocale);
}

export function normalizeLocale(value?: string | null): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  const lowered = value.toLowerCase();
  if (isAppLocale(lowered)) return lowered;
  const short = lowered.split("-")[0];
  if (isAppLocale(short)) return short;
  return DEFAULT_LOCALE;
}
