"use client";

import { useState } from "react";
import { CheckCircle, Globe, Mail, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";
const labelClass = "mb-1.5 block text-sm font-medium text-text-primary";
const hintClass = "mt-1.5 text-xs text-text-muted";

export interface OnboardingStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  userId?: string;
  username?: string | null;
}

export function WelcomeStep({ onNext, onSkip }: OnboardingStepProps) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Globe className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">
          {t("welcomeHeading")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {t("welcomeSubheading")}
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-bg-page p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">{t("welcomeFeature1Title")}</p>
            <p className="text-text-muted">{t("welcomeFeature1Body")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">{t("welcomeFeature2Title")}</p>
            <p className="text-text-muted">{t("welcomeFeature2Body")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">{t("welcomeFeature3Title")}</p>
            <p className="text-text-muted">{t("welcomeFeature3Body")}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {t("skipForNow")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          {t("getStarted")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AddMonitorStep({
  onNext,
  onBack,
  onSkip,
}: OnboardingStepProps) {
  const t = useTranslations("onboarding");
  const tForm = useTranslations("monitorForm");
  const [name, setName] = useState(t("addMonitorDefaultName"));
  const [url, setUrl] = useState("https://example.com");
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          intervalMinutes,
          timeoutSeconds: 15,
          method: "GET",
          expectedStatusCodes: "200-299",
          alertEmail: false,
          showOnStatusPage: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("addMonitorFailed"));
        return;
      }
      onNext();
    } catch {
      setError(t("addMonitorFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("titleAddMonitor")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("addMonitorSubheading")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="onboarding-name" className={labelClass}>
          {tForm("name")}
        </Label>
        <Input
          id="onboarding-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("addMonitorDefaultName")}
          required
          className={inputClass}
        />
      </div>

      <div>
        <Label htmlFor="onboarding-url" className={labelClass}>
          {tForm("url")}
        </Label>
        <Input
          id="onboarding-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className={inputClass}
        />
        <p className={hintClass}>
          {tForm("urlHint")}
        </p>
      </div>

      <div>
        <Label htmlFor="onboarding-interval" className={labelClass}>
          {t("addMonitorIntervalLabel")}
        </Label>
        <Input
          id="onboarding-interval"
          type="number"
          min={1}
          max={60}
          value={intervalMinutes}
          onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
          className={inputClass}
        />
        <p className={hintClass}>
          {t("addMonitorIntervalHint", { count: intervalMinutes })}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
          className="mr-auto rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {tForm("back")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={submitting}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {t("addMonitorSkip")}
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          variant="default"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? tForm("adding") : t("addMonitorSubmit")}
        </Button>
      </div>
    </form>
  );
}

export function AlertsStep({ onNext, onBack, onSkip }: OnboardingStepProps) {
  const t = useTranslations("onboarding");
  const tForm = useTranslations("monitorForm");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("alertsHeading")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("alertsSubheading")}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4 dark:bg-muted/20">
        <p className="text-sm font-medium text-text-primary">{t("alertsHowItWorks")}</p>
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">1</span>
          <p className="pt-0.5 text-sm text-text-muted">
            {t("alertsStep1")}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">2</span>
          <p className="pt-0.5 text-sm text-text-muted">
            {t("alertsStep2")}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">3</span>
          <p className="pt-0.5 text-sm text-text-muted">
            {t("alertsStep3")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mr-auto rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {tForm("back")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {t("alertsSkip")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          {t("alertsUnderstand")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function StatusPageStep({
  onNext,
  onBack,
  onSkip,
  username,
}: OnboardingStepProps & { username?: string | null }) {
  const t = useTranslations("onboarding");
  const tForm = useTranslations("monitorForm");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Globe className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("titleStatusPage")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("statusPageSubheading")}
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-bg-page p-4">
        {username ? (
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              {t("statusPageYourPage")}
            </p>
            <div className="rounded-md border border-border bg-bg-card p-3">
              <code className="text-sm text-accent">
                /status/{username}
              </code>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {t("statusPageMonitorsNote")}
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              {t("statusPageSetUsername")}
            </p>
            <p className="text-sm text-text-muted">
              {t.rich("statusPageSetUsernameBody", {
                code: (chunks) => (
                  <code className="text-accent">{chunks}</code>
                ),
              })}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mr-auto rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {tForm("back")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {t("statusPageSkip")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          {t("statusPageDone")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CompleteStep({
  onNext,
  onSkip,
}: OnboardingStepProps) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex flex-col gap-6 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-500">
          <CheckCircle className="h-9 w-9" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">
          {t("titleComplete")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {t("completeSubheading")}
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-bg-page p-4 text-left">
        <p className="text-sm font-medium text-text-primary">{t("completeNextSteps")}</p>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            {t("completeNextStep1")}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            {t("completeNextStep2")}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            {t("completeNextStep3")}
          </p>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        {t("completeAccessGuide")}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          {t("completeClose")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          {t("completeDashboard")}
        </Button>
      </div>
    </div>
  );
}
