/**
 * Sends a sample alert email via SMTP when driven by scripts/test-email.mjs --template.
 * Env: EMAIL_TEMPLATE (uptime-down|uptime-up|ssl-expiring|degradation), EMAIL_TO
 */
import nodemailer from "nodemailer";
import { describe, it, expect } from "vitest";
import type { Monitor } from "@/db/schema";
import {
  buildDegradationAlertHtml,
  buildSslAlertHtml,
  buildUptimeAlertHtml,
} from "@/lib/email-templates";
import { getEmailMessages } from "@/lib/email-i18n";

const fixtureMonitor = {
  id: "preview-monitor",
  userId: "preview-user",
  name: "API Gateway",
  url: "https://api.example.com/health",
  intervalMinutes: 5,
  timeoutSeconds: 15,
  method: "GET",
  expectedStatusCodes: "200-299",
  requestHeaders: "[]",
  requestBody: null,
  requestBodyType: "none",
  followRedirects: true,
  maxRedirects: 20,
  lastCheckAt: null,
  currentStatus: false,
  lastStatusChangedAt: null,
  downtimeAckEpisodeAt: null,
  alertEmail: true,
  alertEmailTo: null,
  sslMonitoring: true,
  sslValid: true,
  sslExpiresAt: null,
  sslLastCheckedAt: null,
  showOnStatusPage: true,
  paused: false,
  consecutiveFailures: 3,
  type: "http",
  keywordContains: null,
  keywordShouldExist: true,
  dnsRecordType: null,
  dnsExpectedValue: null,
  tcpHost: null,
  tcpPort: null,
  maintenanceStartsAt: null,
  maintenanceEndsAt: null,
  maintenanceNote: null,
  createdAt: new Date(),
  degradationAlertEnabled: false,
  baselineP75Ms: null,
  baselineSampleCount: null,
  consecutiveDegradedChecks: null,
  degradingAlertSentAt: null,
  baselineResetAt: null,
} satisfies Monitor;

const templates = {
  "uptime-down": async () => {
    const messages = await getEmailMessages("en");
    return {
      subject: messages.uptime.subjectDown.replace("{name}", fixtureMonitor.name),
      html: buildUptimeAlertHtml(
        fixtureMonitor,
        false,
        { monitorId: fixtureMonitor.id, ok: false, statusCode: 503, responseTimeMs: 1240, message: "Service Unavailable" },
        new Date().toUTCString(),
        messages,
        "en",
        { monitorDetailUrl: "https://example.com/monitors/preview-monitor" },
      ),
    };
  },
  "uptime-up": async () => {
    const messages = await getEmailMessages("en");
    return {
      subject: messages.uptime.subjectUp.replace("{name}", fixtureMonitor.name),
      html: buildUptimeAlertHtml(
        fixtureMonitor,
        true,
        { monitorId: fixtureMonitor.id, ok: true, statusCode: 200, responseTimeMs: 142 },
        new Date().toUTCString(),
        messages,
        "en",
        { monitorDetailUrl: "https://example.com/monitors/preview-monitor" },
      ),
    };
  },
  "ssl-expiring": async () => {
    const messages = await getEmailMessages("en");
    return {
      subject: messages.ssl.subjectExpiring.replace("{name}", fixtureMonitor.name),
      html: buildSslAlertHtml(
        fixtureMonitor,
        {
          valid: true,
          daysUntilExpiry: 7,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          error: null,
        },
        "expiring",
        new Date().toUTCString(),
        messages,
        "en",
        "https://example.com/monitors/preview-monitor",
      ),
    };
  },
  degradation: async () => {
    const messages = await getEmailMessages("en");
    return {
      subject: messages.degradation.subject
        .replace("{name}", fixtureMonitor.name)
        .replace("{ratio}", "4.2"),
      html: buildDegradationAlertHtml(
        fixtureMonitor,
        890,
        210,
        new Date().toUTCString(),
        messages,
        "en",
        "https://example.com/monitors/preview-monitor",
      ),
    };
  },
} as const;

describe("send template email", () => {
  it.skipIf(!process.env.EMAIL_TEMPLATE)("sends via SMTP", async () => {
    const templateKey = process.env.EMAIL_TEMPLATE as keyof typeof templates;
    const to = process.env.EMAIL_TO;
    const host = process.env.SMTP_HOST;

    expect(to).toBeTruthy();
    expect(host).toBeTruthy();
    expect(templateKey in templates).toBe(true);

    const build = templates[templateKey];
    const { subject, html } = await build();

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });

    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
      to: to!,
      subject: `[Preview] ${subject}`,
      html,
    });
    console.log("Template email sent:", info.messageId);
  });
});
