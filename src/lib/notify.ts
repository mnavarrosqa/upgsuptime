import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslCheckResult } from "@/lib/check-ssl";
import { buildUptimeAlertHtml, buildSslAlertHtml } from "@/lib/email-templates";

export type SslAlertType = "invalid" | "expiring" | "critical" | "recovered";

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
  } else {
    subject = `[Down] ${m.name} — unreachable`;
  }

  const checkedAt = new Date().toUTCString();
  const textLines = [
    `Monitor: ${m.name}`,
    `${monitorType === "dns" ? "Host" : "URL"}: ${m.url}`,
    `Status: ${newStatus ? "UP" : "DOWN"}`,
    ``,
    result.statusCode != null ? `Status code: ${result.statusCode}` : null,
    result.responseTimeMs != null ? `Response time: ${result.responseTimeMs}ms` : null,
    result.message ? `Error: ${result.message}` : null,
    ``,
    `Checked at: ${checkedAt}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = buildUptimeAlertHtml(m, newStatus, result, checkedAt);

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
): Promise<void> {
  if (!m.alertEmail) return;

  try {
    await sendEmailAlert(m, newStatus, result, ownerEmail);
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

  const textLines = [
    `Monitor: ${m.name}`,
    `URL: ${m.url}`,
    statusLine,
    expiryLine,
    ``,
    `Checked at: ${checkedAt}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = buildSslAlertHtml(m, sslResult, alertType, checkedAt);

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
