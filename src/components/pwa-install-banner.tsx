"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share } from "lucide-react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "pwa-install-dismissed";
// Don't re-show for 30 days after dismissal
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Platform = "android" | "ios" | null;

function detectPlatform(): Platform {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // iOS Safari: no Chrome/CriOS/FxiOS
  if (isIos && !/crios|fxios|opios|chrome/i.test(ua)) return "ios";
  // Android Chrome / Samsung Browser / Edge Mobile
  if (/android/i.test(ua) && /chrome|samsung/i.test(ua)) return "android";
  return null;
}

function isPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const t = useTranslations("installBanner");
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);
  // Android deferred install prompt
  const deferredPrompt = useRef<Event & { prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (isPwa() || wasDismissed()) return;

    const p = detectPlatform();
    if (!p) return;

    if (p === "android") {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPrompt.current = e as Event & { prompt: () => Promise<void> };
        setPlatform("android");
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }

    if (p === "ios") {
      setPlatform("ios");
      // Small delay so the page settles before the banner slides up
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
  }

  async function install() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    deferredPrompt.current = null;
    dismiss();
  }

  if (!visible || !platform) return null;

  return (
    <div
      role="banner"
      aria-live="polite"
      className={`
        fixed bottom-0 left-0 right-0 z-50
        flex items-start gap-3
        border-t border-border bg-bg-card px-4 py-4
        shadow-[0_-4px_16px_rgba(0,0,0,0.08)]
        transition-transform duration-300
        [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]
      `}
    >
      {/* App icon */}
      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
        <span className="text-[18px] font-bold text-bg-card">U</span>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{t("title")}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {platform === "ios" ? (
            <>
              {t("bodyIos").split('"Add to Home Screen"')[0]}
              <Share className="mx-1 inline-block size-3 align-[-1px]" />
              {'"Add to Home Screen"'}
            </>
          ) : (
            t("bodyAndroid")
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {platform === "android" && (
          <button
            onClick={install}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg-card hover:bg-accent-hover"
          >
            {t("install")}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-border hover:text-text-primary"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
