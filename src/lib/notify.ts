import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslCheckResult } from "@/lib/check-ssl";
import { buildUptimeAlertHtml, buildSslAlertHtml } from "@/lib/email-templates";
import {
  canSignEmailAckTokens,
  signEmailAckToken,
} from "@/lib/email-ack-token";

export type SslAlertType = "invalid" | "expiring" | "critical" | "recovered";

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
  downEpisodeAt?: Date,
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const to = m.alertEmailTo ?? ownerEmail;
  const monitorType = m.type ?? "http";

  let subject: string;
  if (newStatus) {
    subject = `[Up] ${m.name} — back online`;
  } else if (monitorType === "dns") {
    subject = `[Down] ${m.name} — DNS check failed`;
  } else if (monitorType === "keyword") {
    subject = `[Down] ${m.name} — keyword check failed`;
  } else if (monitorType === "tcp") {
    subject = `[Down] ${m.name} — TCP port check failed`;
  } else {
    subject = `[Down] ${m.name} — unreachable`;
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

  const textParts: (string | null)[] = [
    `Monitor: ${m.name}`,
    `${monitorType === "dns" || monitorType === "tcp" ? "Host" : "URL"}: ${m.url}`,
    monitorDetailUrl ? `View monitor: ${monitorDetailUrl}` : null,
    `Status: ${newStatus ? "UP" : "DOWN"}`,
    ``,
    result.statusCode != null ? `Status code: ${result.statusCode}` : null,
    result.responseTimeMs != null ? `Response time: ${result.responseTimeMs}ms` : null,
    result.message ? `Error: ${result.message}` : null,
    ``,
    `Checked at: ${checkedAt}`,
  ];
  if (ackEmailUrl) {
    textParts.push(
      ``,
      `Is this downtime expected? Acknowledge it in one click (no login required):`,
      ackEmailUrl,
      ``,
      `This marks the outage in your dashboard. Repeat down alerts for this incident are paused until the outage ends or you undo the acknowledgment; you will still receive an email when the monitor recovers.`
    );
  }
  const textLines = textParts.filter((l): l is string => l !== null).join("\n");

  const html = buildUptimeAlertHtml(m, newStatus, result, checkedAt, {
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
  opts?: { downEpisodeAt?: Date },
): Promise<void> {
  if (!m.alertEmail) return;

  try {
    await sendEmailAlert(m, newStatus, result, ownerEmail, opts?.downEpisodeAt);
  } catch (err) {
    console.error("[notify] email failed for monitor", m.id, err);
  }
}

export async function sendSslNotifications(
  m: Monitor,
  sslResult: SslCheckResult,
  alertType: SslAlertType,
  ownerEmail: string
): Promise<void> {
  if (!m.alertEmail) return;

  const transporter = getTransporter();
  if (!transporter) return;

  const to = m.alertEmailTo ?? ownerEmail;
  const checkedAt = new Date().toUTCString();

  let subject: string;
  let statusLine: string;

  switch (alertType) {
    case "invalid":
      subject = `[SSL] ${m.name} — certificate not trusted`;
      statusLine = `Status: INVALID — ${sslResult.error ?? "Certificate not trusted"}`;
      break;
    case "expiring":
      subject = `[SSL] ${m.name} — expires in ${sslResult.daysUntilExpiry} days`;
      statusLine = `Status: EXPIRING SOON — ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "critical":
      subject = `[SSL] ${m.name} — expires in ${sslResult.daysUntilExpiry} days (critical)`;
      statusLine = `Status: CRITICAL — only ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "recovered":
      subject = `[SSL] ${m.name} — certificate valid again`;
      statusLine = `Status: VALID`;
      break;
  }

  const expiryLine =
    sslResult.expiresAt != null
      ? `Expires: ${new Date(sslResult.expiresAt).toUTCString()} (${sslResult.daysUntilExpiry} days)`
      : null;

  const baseUrl = getAppBaseUrlForEmail();
  const monitorDetailUrl = baseUrl
    ? `${baseUrl}/monitors/${encodeURIComponent(m.id)}`
    : null;

  const textLines = [
    `Monitor: ${m.name}`,
    `URL: ${m.url}`,
    monitorDetailUrl ? `View monitor: ${monitorDetailUrl}` : null,
    statusLine,
    expiryLine,
    ``,
    `Checked at: ${checkedAt}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = buildSslAlertHtml(m, sslResult, alertType, checkedAt, monitorDetailUrl);

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
