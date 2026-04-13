"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const inputClass =
  "h-auto min-h-10 w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary shadow-none placeholder:text-text-muted file:h-7 focus-visible:border-input-focus focus-visible:ring-1 focus-visible:ring-input-focus";

const textareaClass = `${inputClass} min-h-[72px] resize-y`;

type StatusPageSettingsFormProps = {
  username: string | null | undefined;
  statusPageTitle: string | null | undefined;
  statusPageTagline: string | null | undefined;
  statusPageShowPoweredBy: boolean | null | undefined;
};

export function StatusPageSettingsForm({
  username,
  statusPageTitle,
  statusPageTagline,
  statusPageShowPoweredBy,
}: StatusPageSettingsFormProps) {
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const apiErrorMessage = useApiErrorMessage();
  const router = useRouter();
  const [title, setTitle] = useState(statusPageTitle ?? "");
  const [tagline, setTagline] = useState(statusPageTagline ?? "");
  const [showPoweredBy, setShowPoweredBy] = useState(
    statusPageShowPoweredBy !== false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUsername = Boolean(username?.trim());
  const publicPath = hasUsername ? `/status/${username}` : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasUsername) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/status-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statusPageTitle: title.trim() || null,
          statusPageTagline: tagline.trim() || null,
          statusPageShowPoweredBy: showPoweredBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data));
        return;
      }
      toast.success(tAccount("statusPageSaved"));
      router.refresh();
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {!hasUsername ? (
        <p className="text-sm text-text-muted">{tAccount("statusPageNeedUsername")}</p>
      ) : (
        <>
          <div>
            <Label className="mb-1.5 block text-sm font-medium text-text-primary">
              {tAccount("statusPageUrlLabel")}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border bg-bg-page px-2.5 py-1.5 text-sm text-text-primary">
                {publicPath}
              </code>
              <a
                href={publicPath!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {tAccount("statusPageOpen")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>

          <div>
            <Label
              htmlFor="status-page-title"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              {tAccount("statusPageTitleLabel")}{" "}
              <span className="font-normal text-text-muted">({tCommon("optional")})</span>
            </Label>
            <input
              id="status-page-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={username ?? ""}
              maxLength={120}
              disabled={saving}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-text-muted">{tAccount("statusPageTitleHelp")}</p>
          </div>

          <div>
            <Label
              htmlFor="status-page-tagline"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              {tAccount("statusPageTaglineLabel")}{" "}
              <span className="font-normal text-text-muted">({tCommon("optional")})</span>
            </Label>
            <textarea
              id="status-page-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={tAccount("statusPageTaglinePlaceholder")}
              maxLength={400}
              rows={3}
              disabled={saving}
              className={textareaClass}
            />
            <p className="mt-1.5 text-xs text-text-muted">{tAccount("statusPageTaglineHelp")}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={showPoweredBy}
              onChange={(e) => setShowPoweredBy(e.target.checked)}
              disabled={saving}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input-border accent-accent"
            />
            <span className="text-sm leading-snug text-text-primary">
              {tAccount("statusPageShowPoweredBy")}
            </span>
          </label>
        </>
      )}

      <div>
        <Button
          type="submit"
          disabled={saving || !hasUsername}
          variant="default"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-page hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? tAccount("saving") : tAccount("statusPageSave")}
        </Button>
      </div>
    </form>
  );
}
