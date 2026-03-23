"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, RefreshCw } from "lucide-react";

const THRESHOLD = 80;
const MAX_PULL = 120;
const HINT_KEY = "ptr-hint-count";
const HINT_MAX = 3;

function isPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PullToRefresh() {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const armed = useRef(false);
  const startY = useRef(0);
  const pwa = useRef(false);

  useEffect(() => {
    pwa.current = isPwa();
    if (!pwa.current) return;

    // Disable native overscroll so our gesture isn't competing
    document.documentElement.style.overscrollBehavior = "contain";

    // First-use hint
    const count = parseInt(localStorage.getItem(HINT_KEY) ?? "0", 10);
    if (count < HINT_MAX) {
      setShowHint(true);
      localStorage.setItem(HINT_KEY, String(count + 1));
      const t = setTimeout(() => setShowHint(false), 3500);
      return () => {
        clearTimeout(t);
        document.documentElement.style.overscrollBehavior = "";
      };
    }

    return () => {
      document.documentElement.style.overscrollBehavior = "";
    };
  }, []);

  useEffect(() => {
    if (!pwa.current) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY !== 0) {
        armed.current = false;
        return;
      }
      armed.current = true;
      startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!armed.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Resistance curve so it feels springy
      const resistance = Math.min(delta * 0.5 + Math.sqrt(delta) * 3, MAX_PULL);
      setPullDistance(resistance);
    }

    function onTouchEnd() {
      if (!armed.current) return;
      armed.current = false;

      setPullDistance((d) => {
        if (d >= THRESHOLD) {
          setIsRefreshing(true);
          router.refresh();
          setTimeout(() => {
            setIsRefreshing(false);
          }, 1500);
        }
        return 0;
      });
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  const isPulling = pullDistance > 0;
  const pastThreshold = pullDistance >= THRESHOLD;
  // Translate the indicator from above the viewport into view as the user pulls
  const translateY = isRefreshing ? 12 : Math.max(pullDistance - 48, -48);
  const opacity = isRefreshing ? 1 : Math.min(pullDistance / THRESHOLD, 1);

  return (
    <>
      {/* Pull indicator — fixed, slides down from top */}
      {(isPulling || isRefreshing) && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2"
          style={{
            transform: `translateX(-50%) translateY(${translateY}px)`,
            opacity,
            transition: isRefreshing ? "transform 0.2s ease, opacity 0.2s ease" : "none",
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex size-9 items-center justify-center rounded-full border border-border bg-bg-card shadow-md">
              {isRefreshing ? (
                <RefreshCw className="size-4 animate-spin text-text-muted" />
              ) : (
                <ArrowDown
                  className="size-4 text-text-muted transition-transform duration-150"
                  style={{ transform: pastThreshold ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              )}
            </div>
            <span className="rounded-full bg-bg-card px-2 py-0.5 text-[10px] text-text-muted shadow-sm">
              {isRefreshing ? "Refreshing…" : pastThreshold ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}

      {/* First-use hint — fades in then out */}
      <div
        aria-live="polite"
        className="pointer-events-none flex justify-center py-1 text-[11px] text-text-muted transition-opacity duration-700"
        style={{ opacity: showHint ? 1 : 0 }}
      >
        ↓ Pull down to refresh
      </div>
    </>
  );
}
