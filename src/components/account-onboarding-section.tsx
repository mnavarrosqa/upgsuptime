"use client";

import { useState } from "react";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AccountOnboardingSectionProps {
  onboardingCompleted?: boolean | null;
  userId: string;
  className?: string;
}

export function AccountOnboardingSection({
  onboardingCompleted,
  userId,
  className,
}: AccountOnboardingSectionProps) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <>
      <div id="onboarding" className={cn("mt-10", className)}>
        <h2
          className="text-base font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Onboarding
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {!onboardingCompleted
            ? "Complete the setup guide to learn the basics."
            : "You've completed the onboarding guide."}
        </p>
        <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
          <Button
            type="button"
            variant="default"
            onClick={() => setShowOnboarding(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
          >
            {onboardingCompleted ? "View onboarding guide" : "Continue onboarding"}
          </Button>
        </div>
      </div>

      <OnboardingOverlay
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        userId={userId}
        currentStep={null as "welcome" | "add-monitor" | "alerts" | "status-page" | "complete" | null}
        onComplete={() => {
          setShowOnboarding(false);
          router.refresh();
        }}
      />
    </>
  );
}
