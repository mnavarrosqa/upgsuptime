import { cn } from "@/lib/utils";

/** Flat inset panel for email alert settings (matches alert email detail blocks). */
export function NotificationsPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border bg-muted/30 p-4 dark:bg-muted/20",
        className,
      )}
    >
      {children}
    </div>
  );
}
