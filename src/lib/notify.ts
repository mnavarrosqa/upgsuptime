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

function buildMergedDownSslTextLines(
  sslResult: SslCheckResult,
  mergedSslAlertType: Exclude<SslAlertType, "recovered">
): string[] {
  const lines: string[] = ["", "SSL Certificate"];
  switch (mergedSslAlertType) {
    case "invalid":
      lines.push(
        `  Status: INVALID — ${sslResult.error ?? "Certificate not trusted"}`
      );
      break;
    case "expiring":
      lines.push(
        `  Status: EXPIRING SOON — ${sslResult.daysUntilExpiry} days remaining`
      );
      break;
    case "critical":
      lines.push(
        `  Status: CRITICAL — only ${sslResult.daysUntilExpiry} days remaining`
      );
      break;
  }
  if (sslResult.expiresAt != null) {
    lines.push(
      `  Expires: ${new Date(sslResult.expiresAt).toUTCString()} (${sslResult.daysUntilExpiry} days)`
    );
  }
  return lines;
}

export async function sendEmailAlert(
  m: Monitor,
  newStatus: boolean,
  result: RunCheckResult,
  ownerEmail: string,
  sslResult: SslCheckResult | null = null,
  mergedSslAlertType: SslAlertType | null = null
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const to = m.alertEmailTo ?? ownerEmail;
  const statusLabel = newStatus ? "UP" : "DOWN";

  const monitorType = m.type ?? "http";

  let subject: string;
  if (newStatus) {
    subject = `📶 ${m.name} — back online`;
  } else if (
    monitorType === "http" &&
    sslResult &&
    mergedSslAlertType &&
    mergedSslAlertType !== "recovered"
  ) {
    switch (mergedSslAlertType) {
      case "invalid":
        subject = `🛡️ ${m.name} — unreachable, SSL not trusted`;
        break;
      case "expiring":
        subject = `🛡️ ${m.name} — unreachable, SSL expires in ${sslResult.daysUntilExpiry} days`;
        break;
      case "critical":
        subject = `🛡️ ${m.name} — unreachable, SSL critical (${sslResult.daysUntilExpiry} days)`;
        break;
      default:
        subject = `📴 ${m.name} — unreachable`;
    }
  } else if (monitorType === "dns") {
    subject = `📴 ${m.name} — DNS check failed`;
  } else if (monitorType === "keyword") {
    subject = `📴 ${m.name} — keyword check failed`;
  } else {
    subject = `📴 ${m.name} — unreachable`;
  }

  const checkedAt = new Date().toUTCString();
  const sslLines: string[] = [];
  if (newStatus && sslResult) {
    sslLines.push("", "SSL Certificate");
    if (sslResult.valid) {
      sslLines.push(`  Status: Valid`);
      if (sslResult.expiresAt != null) {
        sslLines.push(`  Expires: ${new Date(sslResult.expiresAt).toUTCString()} (${sslResult.daysUntilExpiry} days)`);
      }
    } else {
      sslLines.push(`  Status: Invalid — ${sslResult.error ?? "Certificate not trusted"}`);
    }
  } else if (
    !newStatus &&
    sslResult &&
    mergedSslAlertType &&
    mergedSslAlertType !== "recovered"
  ) {
    sslLines.push(
      ...buildMergedDownSslTextLines(sslResult, mergedSslAlertType)
    );
  }
  const textLines = [
    `Monitor: ${m.name}`,
    `${(m.type ?? "http") === "dns" ? "Host" : "URL"}: ${m.url}`,
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

  const html = buildUptimeAlertHtml(
    m,
    newStatus,
    result,
    checkedAt,
    sslResult,
    mergedSslAlertType
  );

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
  sslResult: SslCheckResult | null = null,
  mergedSslAlertType: SslAlertType | null = null
): Promise<void> {
  if (!m.alertEmail) return;

  try {
    await sendEmailAlert(
      m,
      newStatus,
      result,
      ownerEmail,
      sslResult,
      mergedSslAlertType
    );
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
      subject = `🔐 ${m.name} — SSL certificate not trusted`;
      statusLine = `Status: INVALID — ${sslResult.error ?? "Certificate not trusted"}`;
      break;
    case "expiring":
      subject = `📅 ${m.name} — SSL expires in ${sslResult.daysUntilExpiry} days`;
      statusLine = `Status: EXPIRING SOON — ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "critical":
      subject = `⏰ ${m.name} — SSL expires in ${sslResult.daysUntilExpiry} days`;
      statusLine = `Status: CRITICAL — only ${sslResult.daysUntilExpiry} days remaining`;
      break;
    case "recovered":
      subject = `🔓 ${m.name} — SSL certificate valid again`;
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
