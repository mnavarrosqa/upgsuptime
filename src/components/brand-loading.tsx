import { BrandMark } from "@/components/brand-mark";

export function BrandLoading({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-5 text-text-primary ${fullScreen ? "min-h-[70svh] w-full" : "py-8"}`}>
      <BrandMark size={fullScreen ? 72 : 40} animated />
      {fullScreen && (
        <span
          className="text-xl font-semibold tracking-tight motion-safe:animate-[fade-slide-up_0.6s_ease-out_0.3s_both]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          UPG Monitor
        </span>
      )}
      <span className="text-sm text-text-muted motion-safe:animate-[fade-slide-up_0.6s_ease-out_0.5s_both]">{label}</span>
    </div>
  );
}
