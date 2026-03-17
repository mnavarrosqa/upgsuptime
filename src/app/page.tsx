"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data: { needsSetup: boolean }) => {
        if (data.needsSetup) {
          router.replace("/setup");
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-bg-page">
      <p className="text-text-muted">Redirecting…</p>
    </div>
  );
}
