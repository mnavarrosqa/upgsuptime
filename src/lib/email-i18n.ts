import type { AppLocale } from "@/i18n/config";
import { normalizeLocale } from "@/i18n/config";

export type EmailMessages = {
  wordmark: string;
  footer: string;
  viewMonitor: string;
  checkedAt: string;
  monitor: string;
  url: string;
  host: string;
  status: string;
  statusUp: string;
  statusDown: string;
  statusCode: string;
  responseTime: string;
  error: string;
  daysRemaining: string;
  expires: string;
  viewMonitorText: string;
  uptime: {
    badgeUp: string;
    badgeDown: string;
    subjectUp: string;
    subjectDown: string;
    subjectDownDns: string;
    subjectDownKeyword: string;
    subjectDownTcp: string;
    headlineUp: string;
    headlineDown: string;
    headlineDownDns: string;
    headlineDownKeyword: string;
    headlineDownTcp: string;
    ackTitle: string;
    ackBody: string;
    ackButton: string;
    ackTextIntro: string;
    ackTextUrl: string;
    ackTextFooter: string;
  };
  ssl: {
    badgeExpiring: string;
    badgeCritical: string;
    subjectExpiring: string;
    subjectCritical: string;
    headlineExpiring: string;
    headlineCritical: string;
    statusExpiring: string;
    statusCritical: string;
    expiresLine: string;
  };
  degradation: {
    badge: string;
    subject: string;
    headline: string;
    subhead: string;
    recentP75: string;
    baselineP75: string;
    slowdown: string;
    slowdownValue: string;
    textRecentP75: string;
    textBaselineP75: string;
    textSlowdown: string;
  };
};

const cache = new Map<AppLocale, EmailMessages>();

export async function getEmailMessages(
  locale?: string | null,
): Promise<EmailMessages> {
  const normalized = normalizeLocale(locale);
  const cached = cache.get(normalized);
  if (cached) return cached;

  const bundle = (await import(`../../messages/${normalized}.json`)).default as {
    emails: EmailMessages;
  };
  const messages = bundle.emails;
  cache.set(normalized, messages);
  return messages;
}

function getNested(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

export function emailFormat(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function emailT(
  messages: EmailMessages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  return emailFormat(
    getNested(messages as unknown as Record<string, unknown>, key),
    vars,
  );
}
