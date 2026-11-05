/**
 * Locale-aware number display, so Spanish reads "99,7 %" and "1.320" while
 * English reads "99.7%" and "1,320".
 */

/** `value` is 0–100. Whole numbers drop the decimals ("100 %", not "100,0 %"). */
export function formatPercent(value: number, locale: string, maxFractionDigits = 1): string {
  return (value / 100).toLocaleString(locale, {
    style: "percent",
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, maxFractionDigits),
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale);
}
