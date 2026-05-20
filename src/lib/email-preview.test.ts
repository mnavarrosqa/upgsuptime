/**
 * Generates HTML previews for alert email templates.
 * Run: npm run preview:email
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
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

describe("email preview generator", () => {
  it("writes HTML files to tmp/", async () => {
    const outDir = join(process.cwd(), "tmp");
    mkdirSync(outDir, { recursive: true });
    const messages = await getEmailMessages("en");
    const checkedAt = "Mon, 19 May 2026 12:00:00 GMT";
    const monitorDetailUrl = "https://uptime.example.com/monitors/preview-monitor";

    const previews: Record<string, string> = {
      "email-preview-uptime-down.html": buildUptimeAlertHtml(
        fixtureMonitor,
        false,
        {
          ok: false,
          statusCode: 503,
          responseTimeMs: 1240,
          message: "Service Unavailable",
        },
        checkedAt,
        messages,
        "en",
        {
          ackEmailUrl:
            "https://uptime.example.com/api/monitors/preview-monitor/ack-downtime/email?token=preview",
          monitorDetailUrl,
        },
      ),
      "email-preview-uptime-up.html": buildUptimeAlertHtml(
        fixtureMonitor,
        true,
        { ok: true, statusCode: 200, responseTimeMs: 142 },
        checkedAt,
        messages,
        "en",
        { monitorDetailUrl },
      ),
      "email-preview-ssl-expiring.html": buildSslAlertHtml(
        fixtureMonitor,
        {
          valid: true,
          daysUntilExpiry: 7,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          error: null,
        },
        "expiring",
        checkedAt,
        messages,
        "en",
        monitorDetailUrl,
      ),
      "email-preview-degradation.html": buildDegradationAlertHtml(
        fixtureMonitor,
        890,
        210,
        checkedAt,
        messages,
        "en",
        monitorDetailUrl,
      ),
    };

    for (const [filename, html] of Object.entries(previews)) {
      writeFileSync(join(outDir, filename), html, "utf8");
    }
  });
});
