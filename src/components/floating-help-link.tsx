"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";
import { useTranslations } from "next-intl";

const BUBBLE_AUTO_HIDE_MS = 8000;
const DISMISS_STORAGE_KEY = "upg-floating-help-dismissed";

function getBubbleKey(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "floatingHelpBubbleDashboard";
  if (pathname.startsWith("/monitors")) return "floatingHelpBubbleMonitors";
  if (pathname.startsWith("/activity")) return "floatingHelpBubbleActivity";
  if (pathname.startsWith("/account")) return "floatingHelpBubbleAccount";
  if (pathname.startsWith("/admin")) return "floatingHelpBubbleAdmin";
  return "floatingHelpBubble";
}

export function FloatingHelpLink() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const bubbleKey = useMemo(() => getBubbleKey(pathname), [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/help")) return;

    const dismissed =
      window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === "true";

    if (dismissed) return;
    const showTimeout = window.setTimeout(() => {
      setBubbleVisible(true);
    }, 0);
    const hideTimeout = window.setTimeout(() => {
      setBubbleVisible(false);
    }, BUBBLE_AUTO_HIDE_MS);

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [pathname]);

  if (pathname.startsWith("/help")) return null;

  function dismissBubble() {
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, "true");
    setBubbleVisible(false);
  }

  return (
    <aside
      className="fixed bottom-6 left-4 z-30 flex max-w-[calc(100vw-2rem)] items-end gap-3 sm:left-6"
      aria-label={t("floatingHelpRegion")}
    >
      <Link
        href="/help"
        aria-label={t("floatingHelpLabel")}
        className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-bg-card text-text-primary shadow-md transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-input-focus hover:bg-bg-page hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page motion-safe:active:scale-95"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </Link>
      <div
        className={`relative mb-1 max-w-[calc(100vw-5.5rem)] rounded-2xl border border-border bg-bg-card py-2 pl-3 pr-2 text-xs leading-relaxed text-text-muted shadow-md transition-[opacity,transform] duration-300 sm:max-w-[18rem] ${
          bubbleVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0"
        }`}
        aria-hidden={!bubbleVisible}
      >
        <span
          className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 border-b border-l border-border bg-bg-card"
          aria-hidden
        />
        <div className="relative flex items-start gap-2">
          <Link
            href="/help"
            tabIndex={bubbleVisible ? 0 : -1}
            className="text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:text-text-primary"
          >
            {t(bubbleKey)}
          </Link>
          <button
            type="button"
            tabIndex={bubbleVisible ? 0 : -1}
            aria-label={t("floatingHelpDismiss")}
            onClick={dismissBubble}
            className="-mr-0.5 mt-0.5 rounded-full p-0.5 text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-focus"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
