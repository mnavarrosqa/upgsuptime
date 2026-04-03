"use client";

import { useState } from "react";
import { CheckCircle, Globe, Mail, ArrowRight } from "lucide-react";
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
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Globe className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">
          Welcome to UPG Monitor
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Keep your websites and services online. Get notified the moment they go
          down.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-bg-page p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Monitor your sites</p>
            <p className="text-text-muted">
              Add URLs and we&apos;ll check them every few minutes
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Get instant alerts</p>
            <p className="text-text-muted">
              Receive email notifications when status changes
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Share status pages</p>
            <p className="text-text-muted">
              Public pages showing your services&apos; uptime
            </p>
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
          Skip for now
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          Get Started
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
  const [name, setName] = useState("My Website");
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
        setError(data.error ?? "Failed to add monitor");
        return;
      }
      onNext();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Add Your First Monitor
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Enter the URL you want to monitor and we&apos;ll check it every few
          minutes.
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
          Name
        </Label>
        <Input
          id="onboarding-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Website"
          required
          className={inputClass}
        />
      </div>

      <div>
        <Label htmlFor="onboarding-url" className={labelClass}>
          URL
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
          Must be a valid HTTP or HTTPS URL.
        </p>
      </div>

      <div>
        <Label htmlFor="onboarding-interval" className={labelClass}>
          Check interval (minutes)
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
          We&apos;ll check this URL every {intervalMinutes} minute
          {intervalMinutes !== 1 ? "s" : ""}.
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
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={submitting}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          Skip this step
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          variant="default"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? "Adding…" : "Add Monitor"}
        </Button>
      </div>
    </form>
  );
}

export function AlertsStep({ onNext, onBack, onSkip }: OnboardingStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          Get Notified by Email
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Receive instant email alerts when your services go down or come back up.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-bg-page p-4">
        <p className="text-sm font-medium text-text-primary">How it works</p>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            Enable email alerts when creating or editing a monitor
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            You&apos;ll receive emails at your account address or a custom email
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            Alerts fire only when status changes, avoiding spam
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
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          Skip this step
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          I understand
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
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Globe className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          Public Status Pages
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Share a public page showing your services&apos; uptime history and
          current status.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-bg-page p-4">
        {username ? (
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              Your status page
            </p>
            <div className="rounded-md border border-border bg-bg-card p-3">
              <code className="text-sm text-accent">
                /status/{username}
              </code>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Monitors marked to appear on status page will show here
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              Set your username first
            </p>
            <p className="text-sm text-text-muted">
              Go to Account settings to set a username, then your status page
              will be available at <code className="text-accent">/status/[username]</code>
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
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          Skip this step
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          Done
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
  return (
    <div className="flex flex-col gap-6 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-500">
          <CheckCircle className="h-9 w-9" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">
          You&apos;re All Set!
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          You&apos;ve learned the basics of uptime monitoring.
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-bg-page p-4 text-left">
        <p className="text-sm font-medium text-text-primary">Next steps</p>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            Add more monitors to track all your services
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            Enable email alerts to get notified of changes
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="text-sm text-text-muted">
            Check the Activity page to see status history
          </p>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        You can access this guide anytime from Account settings.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="rounded-md px-0 text-sm font-medium text-text-muted hover:bg-transparent hover:text-text-primary"
        >
          Close
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
