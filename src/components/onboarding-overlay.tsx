"use client";

import { useState, useEffect, startTransition } from "react";
import { Overlay } from "@/components/overlay";
import {
  WelcomeStep,
  AddMonitorStep,
  AlertsStep,
  StatusPageStep,
  CompleteStep,
  type OnboardingStepProps,
} from "@/components/onboarding-steps";
import { OnboardingIndicator, type StepIdType } from "@/components/onboarding-indicator";
import { Button } from "@/components/ui/button";

const STEPS: StepIdType[] = [
  "welcome",
  "add-monitor",
  "alerts",
  "status-page",
  "complete",
];

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentStep: StepIdType | null;
  username?: string | null;
  onComplete?: () => void;
}

export function OnboardingOverlay({
  open,
  onClose,
  userId,
  currentStep: initialStep,
  username,
  onComplete,
}: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState<StepIdType>(
    initialStep ?? "welcome"
  );
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  useEffect(() => {
    if (open && initialStep) {
      startTransition(() => setCurrentStep(initialStep));
    }
  }, [open, initialStep]);

  async function updateOnboardingState(step: StepIdType | null, completed: boolean = false) {
    try {
      await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingStep: step,
          onboardingCompleted: completed,
        }),
      });
    } catch (error) {
      console.error("Failed to update onboarding state:", error);
    }
  }

  function handleNext() {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      setCurrentStep(nextStep);
      updateOnboardingState(nextStep);
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1];
      setCurrentStep(prevStep);
      updateOnboardingState(prevStep);
    }
  }

  function handleSkip() {
    setShowSkipConfirm(true);
  }

  function handleConfirmSkip() {
    setShowSkipConfirm(false);
    updateOnboardingState(currentStep);
    onClose();
  }

  function handleCancelSkip() {
    setShowSkipConfirm(false);
  }

  function handleComplete() {
    updateOnboardingState("complete", true);
    onClose();
    onComplete?.();
  }

  const stepProps: OnboardingStepProps = {
    onNext: handleNext,
    onBack: handleBack,
    onSkip: handleSkip,
    userId,
    username,
  };

  function renderStep() {
    switch (currentStep) {
      case "welcome":
        return <WelcomeStep {...stepProps} />;
      case "add-monitor":
        return <AddMonitorStep {...stepProps} />;
      case "alerts":
        return <AlertsStep {...stepProps} />;
      case "status-page":
        return <StatusPageStep {...stepProps} username={username} />;
      case "complete":
        return <CompleteStep {...stepProps} onNext={handleComplete} onSkip={onClose} />;
      default:
        return <WelcomeStep {...stepProps} />;
    }
  }

  const stepTitles: Record<StepIdType, string> = {
    welcome: "Welcome",
    "add-monitor": "Add Your First Monitor",
    alerts: "Email Alerts",
    "status-page": "Public Status Pages",
    complete: "You're All Set!",
  };

  return (
    <Overlay
      open={open}
      onClose={showSkipConfirm ? handleCancelSkip : onClose}
      title={stepTitles[currentStep]}
    >
      <div className="mb-6">
        <OnboardingIndicator currentStep={currentStep} />
      </div>
      {renderStep()}

      {showSkipConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-lg border border-border bg-bg-card p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">
              Skip onboarding?
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              You can access the onboarding guide anytime from Account settings.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelSkip}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-page"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirmSkip}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}
