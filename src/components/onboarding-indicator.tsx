"use client";

import { useTranslations } from "next-intl";

const STEP_IDS = ["welcome", "add-monitor", "alerts", "status-page", "complete"] as const;

type StepId = (typeof STEP_IDS)[number];

const STEP_KEY_MAP: Record<StepId, string> = {
  welcome: "stepWelcome",
  "add-monitor": "stepAddMonitor",
  alerts: "stepAlerts",
  "status-page": "stepStatusPage",
  complete: "stepComplete",
};

interface OnboardingIndicatorProps {
  currentStep: StepId;
}

export function OnboardingIndicator({ currentStep }: OnboardingIndicatorProps) {
  const t = useTranslations("onboarding");
  const currentIndex = STEP_IDS.indexOf(currentStep);

  return (
    <div
      className="flex items-center justify-center gap-2"
      aria-label={t("progressAriaLabel")}
    >
      {STEP_IDS.map((stepId, index) => (
        <div
          key={stepId}
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
            aria-label={`${t(STEP_KEY_MAP[stepId])} — ${
              index === currentIndex
                ? t("stepCurrent")
                : index < currentIndex
                  ? t("stepCompleted")
                  : t("stepNotStarted")
            }`}
          />
          {index < STEP_IDS.length - 1 && (
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
