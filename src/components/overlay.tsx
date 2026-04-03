"use client";

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

export function Overlay({
  open,
  onClose,
  title,
  children,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Replaces default max width (e.g. max-w-2xl). */
  panelClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const focusFirstFocusable = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    focusFirstFocusable();
    return () => {
      previousActiveRef.current?.focus();
    };
  }, [open, focusFirstFocusable]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleFocusIn(e: FocusEvent) {
      const panel = panelRef.current;
      if (!panel || panel.contains(e.target as Node)) return;
      focusFirstFocusable();
    }
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [open, focusFirstFocusable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={!open}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="absolute inset-0 h-full min-h-0 w-full rounded-none border-0 bg-black/50 p-0 hover:bg-black/50 focus-visible:ring-0"
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "overlay-title" : undefined}
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-bg-card p-6 shadow-xl ${panelClassName ?? "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-5 border-b border-border pb-4">
            <h2
              id="overlay-title"
              className="text-base font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
