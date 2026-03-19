import { Spinner } from "@/components/spinner";

interface LoadingOverlayProps {
  message?: string;
  spinnerSize?: "sm" | "default";
  backdrop?: boolean;
}

export function LoadingOverlay({
  message,
  spinnerSize = "default",
  backdrop = true,
}: LoadingOverlayProps) {
  return (
    <div
      role="alert"
      aria-busy="true"
      aria-live="polite"
      className={`fixed inset-0 flex items-center justify-center z-50 ${
        backdrop
          ? "bg-bg-page/80 backdrop-blur-sm"
          : "bg-transparent"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size={spinnerSize} />
        {message && (
          <p className="text-sm font-medium text-text-muted">{message}</p>
        )}
      </div>
    </div>
  );
}
