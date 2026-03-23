"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";

function subscribeStandalone(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getStandaloneSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaRootLoading() {
  const standalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    () => false
  );

  const message = "Loading…";

  return (
    <div
      role="alert"
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 flex items-center justify-center z-50 bg-bg-page/80 backdrop-blur-sm"
    >
      {standalone ? (
        <div className="flex flex-col items-center gap-5">
          <Image
            src="/icon-192.png"
            alt=""
            width={96}
            height={96}
            priority
            className="h-24 w-24 rounded-2xl"
          />
          <p className="text-lg font-semibold text-text">UPG Monitor</p>
          <Spinner />
          <p className="text-sm font-medium text-text-muted">{message}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm font-medium text-text-muted">{message}</p>
        </div>
      )}
    </div>
  );
}
