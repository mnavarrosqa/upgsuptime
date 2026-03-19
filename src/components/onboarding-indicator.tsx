"use client";

const STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "add-monitor", title: "Add Monitor" },
  { id: "alerts", title: "Alerts" },
  { id: "status-page", title: "Status Page" },
  { id: "complete", title: "Complete" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface OnboardingIndicatorProps {
  currentStep: StepId;
}

export function OnboardingIndicator({ currentStep }: OnboardingIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2" aria-label="Onboarding progress">
      {STEPS.map((step, index) => (
        <div
          key={step.id}
          className="flex items-center"
          role="presentation"
        >
          <div
            className={`
              flex h-2 w-2 rounded-full transition-all
              ${index === currentIndex
                ? "h-2.5 w-2.5 bg-accent ring-4 ring-accent/10"
                : index < currentIndex
                  ? "bg-accent"
                  : "bg-border"
              }
            `}
            aria-label={`${step.title} ${index === currentIndex ? "- current step" : index < currentIndex ? "- completed" : "- not started"}`}
          />
          {index < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-4 transition-colors ${
                index < currentIndex ? "bg-accent" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export type StepIdType = StepId;
