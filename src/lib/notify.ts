import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslCheckResult } from "@/lib/check-ssl";
import { buildUptimeAlertHtml, buildSslAlertHtml } from "@/lib/email-templates";

export type SslAlertType = "invalid" | "expiring" | "critical" | "recovered";

let _transporter: Transporter | null | undefined; // undefined = not yet initialized

function getTransporter(): Transporter | null {
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
  sslResult: SslCheckResult | null = null
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const to = m.alertEmailTo ?? ownerEmail;
  const statusLabel = newStatus ? "UP" : "DOWN";
  const subject = newStatus
    ? `[UP] ${m.name} has recovered`
    : `[DOWN] ${m.name} is unreachable`;

  const checkedAt = new Date().toUTCString();
  const sslLines: (string | null)[] = [];
  if (newStatus && sslResult) {
    sslLines.push(``, `SSL Certificate`);
    if (sslResult.valid) {
      sslLines.push(`  Status: Valid`);
      if (sslResult.expiresAt != null) {
        sslLines.push(`  Expires: ${new Date(sslResult.expiresAt).toUTCString()} (${sslResult.daysUntilExpiry} days)`);
      }
    } else {
      sslLines.push(`  Status: Invalid — ${sslResult.error ?? "Certificate not trusted"}`);
    }
  }
  const textLines = [
    `Monitor: ${m.name}`,
    `URL: ${m.url}`,
    `Status: ${statusLabel}`,
    ``,
    result.statusCode != null ? `Status code: ${result.statusCode}` : null,
    result.responseTimeMs != null ? `Response time: ${result.responseTimeMs}ms` : null,
    result.message ? `Error: ${result.message}` : null,
    ...sslLines,
    ``,
    `Checked at: ${checkedAt}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = buildUptimeAlertHtml(m, newStatus, result, checkedAt, sslResult);

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"UPGS Monitor" <${process.env.SMTP_USER}>`,
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
  sslResult: SslCheckResult | null = null
): Promise<void> {
  if (!m.alertEmail) return;

  try {
    await sendEmailAlert(m, newStatus, result, ownerEmail, sslResult);
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
      subject = `[SSL Invalid] ${m.name} — certificate is not trusted`;
      statusLine = `Status: INVALID — ${sslResult.error ?? "Certificate not trusted"}`;
      break;
    case "expiring":
      subject = `[SSL Expiring] ${m.name} — expires in ${sslResult.daysUntilExpiry} days`;
      statusLine = `Status: EXPIRING SOON — ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "critical":
      subject = `[SSL Critical] ${m.name} — expires in ${sslResult.daysUntilExpiry} days`;
      statusLine = `Status: CRITICAL — only ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "recovered":
      subject = `[SSL Recovered] ${m.name} — certificate is valid`;
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
      from: process.env.SMTP_FROM ?? `"UPGS Monitor" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: textLines,
      html,
    });
  } catch (err) {
    console.error("[notify] SSL email failed for monitor", m.id, err);
  }
}
