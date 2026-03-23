import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslAlertType } from "@/lib/notify";
import type { SslCheckResult } from "@/lib/check-ssl";

// ─── shared primitives ────────────────────────────────────────────────────────

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'DM Sans', Helvetica, Arial, sans-serif";

const COLORS = {
  pageBg: "#faf9f7",
  cardBg: "#ffffff",
  border: "#e7e5e4",
  textPrimary: "#1c1917",
  textMuted: "#78716c",
  textFaint: "#a8a29e",
  up: "#059669",
  upBg: "#d1fae5",
  upText: "#065f46",
  down: "#dc2626",
  downBg: "#fee2e2",
  downText: "#991b1b",
  warn: "#d97706",
  warnBg: "#fef3c7",
  warnText: "#92400e",
  critical: "#ea580c",
  criticalBg: "#ffedd5",
  criticalText: "#9a3412",
};

function badge(label: string, bg: string, color: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 12px;border-radius:100px;font-family:${FONT_STACK};">${label}</span>`;
}

function detailRow(label: string, value: string) {
  return `
  <tr>
    <td style="padding:0 20px 0 0;padding-bottom:14px;vertical-align:top;width:40%;">
      <span style="display:block;font-size:11px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:${FONT_STACK};">${label}</span>
    </td>
    <td style="padding-bottom:14px;vertical-align:top;">
      <span style="font-size:14px;color:${COLORS.textPrimary};font-weight:500;font-family:${FONT_STACK};">${value}</span>
    </td>
  </tr>`;
}

/** Neutral double rule (replaces status-colored top stripe). */
function cardTopAccent() {
  return `<tr>
    <td style="padding:0;background:${COLORS.cardBg};border-radius:12px 12px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="height:1px;background:${COLORS.border};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
        <tr><td style="height:5px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
        <tr><td style="height:1px;background:${COLORS.border};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>`;
}

function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${COLORS.pageBg};padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Wordmark -->
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding-bottom:20px;">
              <span style="font-size:12px;color:${COLORS.textFaint};font-weight:600;letter-spacing:0.1em;text-transform:uppercase;font-family:${FONT_STACK};">UPG Monitor</span>
            </td>
          </tr>

          <!-- Card outer (accent + body) -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
                ${cardTopAccent()}
                <tr>
                  <td style="background:${COLORS.cardBg};padding:28px 32px;border-radius:0 0 12px 12px;">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding-top:18px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">
                You're receiving this because email alerts are enabled for this monitor.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sslProblemDetailRows(
  sslResult: SslCheckResult,
  alertType: "invalid" | "expiring" | "critical"
): string[] {
  const rows: string[] = [];
  if (alertType === "invalid") {
    rows.push(
      detailRow("Issue", escHtml(sslResult.error ?? "Certificate not trusted"))
    );
  }
  if (alertType === "expiring" || alertType === "critical") {
    rows.push(detailRow("Days remaining", `${sslResult.daysUntilExpiry}`));
  }
  if (sslResult.expiresAt != null) {
    rows.push(detailRow("Expires", new Date(sslResult.expiresAt).toUTCString()));
  }
  return rows;
}

// ─── uptime alert ─────────────────────────────────────────────────────────────

export function buildUptimeAlertHtml(
  m: Monitor,
  newStatus: boolean,
  result: RunCheckResult,
  checkedAt: string,
  sslResult: SslCheckResult | null = null,
  mergedSslAlertType: SslAlertType | null = null
): string {
  const isUp = newStatus;
  const statusBadge = isUp
    ? badge("● Up", COLORS.upBg, COLORS.upText)
    : badge("● Down", COLORS.downBg, COLORS.downText);

  const headline = isUp
    ? `<span style="color:${COLORS.up};">${escHtml(m.name)}</span> is back online`
    : `<span style="color:${COLORS.down};">${escHtml(m.name)}</span> is unreachable`;

  const rows: string[] = [];
  if (result.statusCode != null)
    rows.push(detailRow("Status code", String(result.statusCode)));
  if (result.responseTimeMs != null)
    rows.push(detailRow("Response time", `${result.responseTimeMs} ms`));
  if (!isUp && result.message)
    rows.push(detailRow("Error", escHtml(result.message)));

  // SSL: recovery summary when UP; problem details when DOWN merged with SSL alert
  let sslSection = "";
  if (
    !isUp &&
    sslResult &&
    mergedSslAlertType &&
    mergedSslAlertType !== "recovered"
  ) {
    const sslRows = sslProblemDetailRows(sslResult, mergedSslAlertType);
    sslSection = `
    <!-- SSL divider -->
    <div style="height:1px;background:${COLORS.border};margin:${rows.length > 0 ? "6px" : "0"} 0 14px;"></div>
    <p style="margin:0 0 10px;font-size:11px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:${FONT_STACK};">SSL Certificate</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${sslRows.join("")}</table>`;
  } else if (isUp && sslResult) {
    const sslRows: string[] = [];
    if (sslResult.valid) {
      sslRows.push(detailRow("SSL Status", "Valid"));
      if (sslResult.expiresAt != null) {
        sslRows.push(
          detailRow(
            "SSL Expires",
            `${new Date(sslResult.expiresAt).toUTCString()} (${sslResult.daysUntilExpiry} days)`
          )
        );
      }
    } else {
      sslRows.push(
        detailRow(
          "SSL Status",
          `<span style="color:${COLORS.down};">Invalid</span> — ${escHtml(sslResult.error ?? "Certificate not trusted")}`
        )
      );
    }
    sslSection = `
    <!-- SSL divider -->
    <div style="height:1px;background:${COLORS.border};margin:${rows.length > 0 ? "6px" : "0"} 0 14px;"></div>
    <p style="margin:0 0 10px;font-size:11px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.07em;font-weight:600;font-family:${FONT_STACK};">SSL Certificate</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${sslRows.join("")}</table>`;
  }

  const hasDetails = rows.length > 0 || sslSection;
  const body = `
    <!-- Badge -->
    <div style="margin-bottom:16px;">${statusBadge}</div>

    <!-- Headline -->
    <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:${COLORS.textPrimary};line-height:1.3;font-family:${FONT_STACK};">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;color:${COLORS.textMuted};font-family:${FONT_STACK};">${escHtml(m.url)}</p>

    <!-- Divider -->
    <div style="height:1px;background:${COLORS.border};margin:24px 0;"></div>

    <!-- Details -->
    ${
      rows.length > 0
        ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows.join("")}</table>`
        : ""
    }
    ${sslSection}

    <!-- Timestamp -->
    <p style="margin:${hasDetails ? "6px" : "0"} 0 0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">
      Checked at ${escHtml(checkedAt)}
    </p>`;

  return wrap(body);
}

// ─── SSL alert ────────────────────────────────────────────────────────────────

export function buildSslAlertHtml(
  m: Monitor,
  sslResult: SslCheckResult,
  alertType: SslAlertType,
  checkedAt: string
): string {
  let statusBadge: string;
  let headline: string;

  switch (alertType) {
    case "invalid":
      statusBadge = badge("● SSL Invalid", COLORS.downBg, COLORS.downText);
      headline = `SSL certificate for <span style="color:${COLORS.down};">${escHtml(m.name)}</span> is not trusted`;
      break;
    case "expiring":
      statusBadge = badge(`● SSL Expiring`, COLORS.warnBg, COLORS.warnText);
      headline = `SSL certificate for <span style="color:${COLORS.warn};">${escHtml(m.name)}</span> is expiring soon`;
      break;
    case "critical":
      statusBadge = badge(`● SSL Critical`, COLORS.criticalBg, COLORS.criticalText);
      headline = `SSL certificate for <span style="color:${COLORS.critical};">${escHtml(m.name)}</span> expires very soon`;
      break;
    case "recovered":
      statusBadge = badge("● SSL Valid", COLORS.upBg, COLORS.upText);
      headline = `SSL certificate for <span style="color:${COLORS.up};">${escHtml(m.name)}</span> is valid`;
      break;
  }

  const rows: string[] =
    alertType === "recovered"
      ? [detailRow("Status", "Certificate is valid and trusted")]
      : sslProblemDetailRows(sslResult, alertType);

  const body = `
    <!-- Badge -->
    <div style="margin-bottom:16px;">${statusBadge}</div>

    <!-- Headline -->
    <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:${COLORS.textPrimary};line-height:1.3;font-family:${FONT_STACK};">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;color:${COLORS.textMuted};font-family:${FONT_STACK};">${escHtml(m.url)}</p>

    <!-- Divider -->
    <div style="height:1px;background:${COLORS.border};margin:24px 0;"></div>

    <!-- Details -->
    ${
      rows.length > 0
        ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows.join("")}</table>`
        : ""
    }

    <!-- Timestamp -->
    <p style="margin:${rows.length > 0 ? "6px" : "0"} 0 0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">
      Checked at ${escHtml(checkedAt)}
    </p>`;

  return wrap(body);
}

// ─── util ─────────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
