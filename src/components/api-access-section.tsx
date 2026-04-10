"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useApiErrorMessage, type ApiErrorPayload } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scope: "status:read";
  corsOrigins: string[];
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
};

function formatIso(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ApiAccessSection({
  username,
  className,
}: {
  username: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const apiErrorMessage = useApiErrorMessage();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [originsText, setOriginsText] = useState("");
  const [plainToken, setPlainToken] = useState<string | null>(null);

  const locale = useMemo(() => (typeof navigator !== "undefined" ? navigator.language : "en"), []);
  const endpoint = useMemo(
    () =>
      `${typeof window === "undefined" ? "" : window.location.origin}/api/widget/status`,
    []
  );

  const curlExample = useMemo(
    () =>
      `curl -sS "${endpoint}" \\\n  -H "Authorization: Bearer YOUR_API_TOKEN"`,
    [endpoint]
  );

  const fetchExample = useMemo(
    () =>
      `const res = await fetch("${endpoint}", {\n  headers: {\n    Authorization: "Bearer YOUR_API_TOKEN",\n  },\n});\nconst data = await res.json();\n// data.monitors[] — type, paused, ssl*, uptimePct, checkCount90d, …`,
    [endpoint]
  );

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys");
      const data = await res.json().catch(() => [] as unknown);
      if (!res.ok) {
        toast.error(apiErrorMessage(data as ApiErrorPayload));
        return;
      }
      setKeys(data as ApiKeyItem[]);
    } finally {
      setLoading(false);
    }
  }, [apiErrorMessage]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const corsOrigins = originsText
        .split("\n")
        .map((origin) => origin.trim())
        .filter(Boolean);
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          expiresAt: expiresAt || null,
          corsOrigins,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        errorCode?: string;
        token?: string;
      };
      if (!res.ok) {
        toast.error(apiErrorMessage(data));
        return;
      }
      setPlainToken(data.token ?? null);
      setName("");
      setExpiresAt("");
      setOriginsText("");
      toast.success(t("apiCreateSuccess"));
      await loadKeys();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/user/api-keys/${id}/revoke`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { errorCode?: string };
    if (!res.ok) {
      toast.error(apiErrorMessage(data));
      return;
    }
    toast.success(t("apiRevokeSuccess"));
    await loadKeys();
  }

  async function handleRotate(id: string) {
    const res = await fetch(`/api/user/api-keys/${id}/rotate`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { errorCode?: string; token?: string };
    if (!res.ok) {
      toast.error(apiErrorMessage(data));
      return;
    }
    setPlainToken(data.token ?? null);
    toast.success(t("apiRotateSuccess"));
    await loadKeys();
  }

  async function copy(value: string, successLabel: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successLabel);
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    }
  }

  return (
    <div className={cn("mt-10", className)}>
      <h2 className="text-base font-semibold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
        {t("apiTitle")}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">{t("apiSubtitle")}</p>

      <div className="mt-4 space-y-6 rounded-lg border border-border bg-bg-card px-6 py-5">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t("apiEndpointLabel")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border border-border bg-bg-page px-2 py-1 text-xs text-text-primary">{endpoint}</code>
            <Button type="button" variant="outline" onClick={() => void copy(endpoint, t("apiCopiedEndpoint"))}>
              {t("apiCopy")}
            </Button>
          </div>
          {username && (
            <p className="text-xs text-text-muted">
              {t("apiPublicHint", { username })}
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t("apiExamplesTitle")}</p>
          <p className="text-sm text-text-muted">{t("apiExamplesIntro")}</p>
          <ul className="list-inside list-disc text-sm text-text-muted">
            <li>{t("apiExampleCorsHint")}</li>
            <li>{t("apiExampleQueryHint")}</li>
            <li>{t("apiResponseFieldsHint")}</li>
          </ul>

          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">{t("apiExampleCurlLabel")}</p>
            <div className="relative rounded-md border border-border bg-bg-page">
              <pre className="max-h-48 overflow-x-auto overflow-y-auto p-3 font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-all">
                <code>{curlExample}</code>
              </pre>
              <div className="border-t border-border px-2 py-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => void copy(curlExample, t("apiExampleCopiedSnippet"))}
                >
                  {t("apiCopy")}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">{t("apiExampleFetchLabel")}</p>
            <div className="relative rounded-md border border-border bg-bg-page">
              <pre className="max-h-56 overflow-x-auto overflow-y-auto p-3 font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-all">
                <code>{fetchExample}</code>
              </pre>
              <div className="border-t border-border px-2 py-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => void copy(fetchExample, t("apiExampleCopiedSnippet"))}
                >
                  {t("apiCopy")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {plainToken && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">{t("apiTokenShownOnce")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-auto rounded border border-amber-300 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-950/40">
                {plainToken}
              </code>
              <Button type="button" variant="outline" onClick={() => void copy(plainToken, t("apiCopiedToken"))}>
                {t("apiCopy")}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} className="grid gap-4 rounded-md border border-border p-4">
          <div>
            <Label htmlFor="api-key-name" className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("apiNameLabel")}
            </Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("apiNamePlaceholder")}
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="api-key-expires" className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("apiExpiresLabel")}
            </Label>
            <Input
              id="api-key-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="api-key-origins" className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("apiOriginsLabel")}
            </Label>
            <textarea
              id="api-key-origins"
              className="min-h-24 w-full rounded-md border border-input-border bg-bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-input-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-input-focus"
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
              placeholder={t("apiOriginsPlaceholder")}
            />
          </div>
          <div>
            <Button type="submit" disabled={creating}>
              {creating ? t("saving") : t("apiCreateButton")}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("apiKeysListTitle")}
          </p>
          {loading ? (
            <p className="text-sm text-text-muted">{tCommon("loading")}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-text-muted">{t("apiEmptyState")}</p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="rounded-md border border-border px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{key.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-text-muted">{key.keyPrefix}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => void handleRotate(key.id)}>
                        {t("apiRotate")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => void handleRevoke(key.id)}>
                        {t("apiRevoke")}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {t("apiScopeLabel")}: <span className="font-mono">{key.scope}</span> · {t("apiExpiresLabel")}:{" "}
                    {formatIso(key.expiresAt, locale)} · {t("apiLastUsedLabel")}: {formatIso(key.lastUsedAt, locale)}
                  </p>
                  {key.corsOrigins.length > 0 && (
                    <p className="mt-1 text-xs text-text-muted">
                      {t("apiOriginsLabel")}: {key.corsOrigins.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
