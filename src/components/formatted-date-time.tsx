"use client";

export function FormattedDateTime({
  value,
}: {
  value: string | Date;
}) {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
  return <span suppressHydrationWarning>{formatted}</span>;
}
