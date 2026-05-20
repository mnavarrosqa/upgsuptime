import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslCheckResult } from "@/lib/check-ssl";
import type { AppLocale } from "@/i18n/config";
import { buildUptimeAlertHtml, buildSslAlertHtml } from "@/lib/email-templates";
import { emailFormat, getEmailMessages } from "@/lib/email-i18n";
import {
  canSignEmailAckTokens,
  signEmailAckToken,
} from "@/lib/email-ack-token";

/** Expiry reminder emails only: ~1 week left, then ~2 days left. */
export type SslAlertType = "expiring" | "critical";

/** Base URL for links in emails (NEXTAUTH_URL, or https://VERCEL_URL). */
export function getAppBaseUrlForEmail(): string {
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "";
}

let _transporter: Transporter | null | undefined; // undefined = not yet initialized

export function getTransporter(): Transporter | null {
  if (_transporter !== undefined) return _transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    _transporter = null;
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
  });

  return _transporter;
}

export async function sendEmailAlert(
  m: Monitor,
  newStatus: boolean,
  result: RunCheckResult,
  ownerEmail: string,
  locale: AppLocale,
  downEpisodeAt?: Date,
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const messages = await getEmailMessages(locale);
  const to = m.alertEmailTo ?? ownerEmail;
  const monitorType = m.type ?? "http";

  let subject: string;
  if (newStatus) {
    subject = emailFormat(messages.uptime.subjectUp, { name: m.name });
  } else if (monitorType === "dns") {
    subject = emailFormat(messages.uptime.subjectDownDns, { name: m.name });
  } else if (monitorType === "keyword") {
    subject = emailFormat(messages.uptime.subjectDownKeyword, { name: m.name });
  } else if (monitorType === "tcp") {
    subject = emailFormat(messages.uptime.subjectDownTcp, { name: m.name });
  } else {
    subject = emailFormat(messages.uptime.subjectDown, { name: m.name });
  }

  const checkedAt = new Date().toUTCString();

  const baseUrl = getAppBaseUrlForEmail();
  const monitorDetailUrl = baseUrl
    ? `${baseUrl}/monitors/${encodeURIComponent(m.id)}`
    : null;
  let ackEmailUrl: string | null = null;
  if (
    !newStatus &&
    downEpisodeAt &&
    baseUrl &&
    canSignEmailAckTokens()
  ) {
    const token = signEmailAckToken(m.id, downEpisodeAt.getTime());
    ackEmailUrl = `${baseUrl}/api/monitors/${encodeURIComponent(m.id)}/ack-downtime/email?t=${encodeURIComponent(token)}`;
  }

  const targetLabel =
    monitorType === "dns" || monitorType === "tcp" ? messages.host : messages.url;

  const textParts: (string | null)[] = [
    `${messages.monitor}: ${m.name}`,
    `${targetLabel}: ${m.url}`,
    monitorDetailUrl
      ? emailFormat(messages.viewMonitorText, { url: monitorDetailUrl })
      : null,
    `${messages.status}: ${newStatus ? messages.statusUp : messages.statusDown}`,
    ``,
    result.statusCode != null
      ? `${messages.statusCode}: ${result.statusCode}`
      : null,
    result.responseTimeMs != null
      ? `${messages.responseTime}: ${result.responseTimeMs}ms`
      : null,
    result.message ? `${messages.error}: ${result.message}` : null,
    ``,
    emailFormat(messages.checkedAt, { at: checkedAt }),
  ];
  if (ackEmailUrl) {
    textParts.push(
      ``,
      messages.uptime.ackTextIntro,
      ackEmailUrl,
      ``,
      messages.uptime.ackTextFooter,
    );
  }
  const textLines = textParts.filter((l): l is string => l !== null).join("\n");

  const html = buildUptimeAlertHtml(m, newStatus, result, checkedAt, messages, locale, {
    ackEmailUrl,
    monitorDetailUrl,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: textLines,
    html,
  });
}

export async function sendNotifications(
  m: Monitor,
  newStatus: boolean,
  result: RunCheckResult,
  ownerEmail: string,
  locale: AppLocale,
  opts?: { downEpisodeAt?: Date },
): Promise<void> {
  if (!m.alertEmail) return;

  try {
    await sendEmailAlert(m, newStatus, result, ownerEmail, locale, opts?.downEpisodeAt);
  } catch (err) {
    console.error("[notify] email failed for monitor", m.id, err);
  }
}

export async function sendSslNotifications(
  m: Monitor,
  sslResult: SslCheckResult,
  alertType: SslAlertType,
  ownerEmail: string,
  locale: AppLocale,
): Promise<void> {
  if (!m.alertEmail) return;

  const transporter = getTransporter();
  if (!transporter) return;

  const messages = await getEmailMessages(locale);
  const to = m.alertEmailTo ?? ownerEmail;
  const checkedAt = new Date().toUTCString();

  let subject: string;
  let statusLine: string;

  switch (alertType) {
    case "expiring":
      subject = emailFormat(messages.ssl.subjectExpiring, { name: m.name });
      statusLine = emailFormat(messages.ssl.statusExpiring, {
        days: sslResult.daysUntilExpiry ?? "—",
      });
      break;
    case "critical":
      subject = emailFormat(messages.ssl.subjectCritical, { name: m.name });
      statusLine = emailFormat(messages.ssl.statusCritical, {
        days: sslResult.daysUntilExpiry ?? "—",
      });
      break;
  }

  const expiryLine =
    sslResult.expiresAt != null
      ? emailFormat(messages.ssl.expiresLine, {
          at: new Date(sslResult.expiresAt).toUTCString(),
          days: sslResult.daysUntilExpiry ?? "—",
        })
      : null;

  const baseUrl = getAppBaseUrlForEmail();
  const monitorDetailUrl = baseUrl
    ? `${baseUrl}/monitors/${encodeURIComponent(m.id)}`
    : null;

  const textLines = [
    `${messages.monitor}: ${m.name}`,
    `${messages.url}: ${m.url}`,
    monitorDetailUrl
      ? emailFormat(messages.viewMonitorText, { url: monitorDetailUrl })
      : null,
    statusLine,
    expiryLine,
    ``,
    emailFormat(messages.checkedAt, { at: checkedAt }),
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = buildSslAlertHtml(
    m,
    sslResult,
    alertType,
    checkedAt,
    messages,
    locale,
    monitorDetailUrl,
  );

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: textLines,
      html,
    });
  } catch (err) {
    console.error("[notify] SSL email failed for monitor", m.id, err);
  }
}
