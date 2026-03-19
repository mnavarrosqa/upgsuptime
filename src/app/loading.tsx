import { LoadingOverlay } from "@/components/loading-overlay";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <LoadingOverlay message="Loading…" />
    </div>
  );
}
