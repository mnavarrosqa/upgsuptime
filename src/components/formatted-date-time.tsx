"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";

function subscribeNoop() {
  return () => {};
}

/**
 * Date and time in the app's language. The server renders it in UTC; once
 * hydrated it re-renders in the viewer's own time zone (React would otherwise
 * keep the server's text, since the mismatch is expected).
 */
export function FormattedDateTime({
  value,
}: {
  value: string | Date;
}) {
  const locale = useLocale();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: hydrated ? undefined : DEFAULT_TIME_ZONE,
  }).format(date);
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
