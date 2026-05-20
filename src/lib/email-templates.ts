import type { Monitor } from "@/db/schema";
import type { RunCheckResult } from "@/lib/run-check";
import type { SslAlertType } from "@/lib/notify";
import type { SslCheckResult } from "@/lib/check-ssl";
import type { AppLocale } from "@/i18n/config";
import { emailFormat, type EmailMessages } from "@/lib/email-i18n";

// ─── shared primitives ────────────────────────────────────────────────────────

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'DM Sans', Helvetica, Arial, sans-serif";

const COLORS = {
  pageBg: "#faf9f7",
  cardBg: "#ffffff",
  panelBg: "#f5f5f4",
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

function iconCheck(color: string) {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M1.5 6L4.5 9L10.5 3" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconX(color: string) {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M2 2L10 10M10 2L2 10" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

function iconWarn(color: string) {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M6 1L11.5 10.5H0.5L6 1Z" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/><line x1="6" y1="4.5" x2="6" y2="7" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/><circle cx="6" cy="9" r="0.7" fill="${color}"/></svg>`;
}

function iconLock(color: string) {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><rect x="1.5" y="5.5" width="9" height="5.5" rx="1.2" stroke="${color}" stroke-width="1.4"/><path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

function badge(label: string, bg: string, color: string, icon: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:600;letter-spacing:0.02em;padding:6px 12px;border-radius:100px;font-family:${FONT_STACK};line-height:1.4;"><span style="display:inline-block;vertical-align:middle;margin-right:6px;line-height:0;">${icon}</span><span style="display:inline-block;vertical-align:middle;">${label}</span></span>`;
}

function escAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function primaryButton(href: string, label: string) {
  return `<a href="${escAttr(href)}" style="display:inline-block;background:${COLORS.textPrimary};color:#fafaf9;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT_STACK};min-height:44px;line-height:20px;box-sizing:border-box;">${label}</a>`;
}

function buildMonitorDetailCtaBlock(
  messages: EmailMessages,
  monitorDetailUrl: string | null | undefined,
): string {
  if (!monitorDetailUrl) return "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 0;">
      <tr>
        <td>
          ${primaryButton(monitorDetailUrl, escHtml(messages.viewMonitor))}
        </td>
      </tr>
    </table>`;
}

function buildDownAckEmailBlock(messages: EmailMessages, ackEmailUrl: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 0;">
      <tr>
        <td style="padding:18px 20px;background:${COLORS.warnBg};border-radius:12px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${COLORS.warnText};font-family:${FONT_STACK};">
            ${escHtml(messages.uptime.ackTitle)}
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:${COLORS.textMuted};line-height:1.55;font-family:${FONT_STACK};">
            ${escHtml(messages.uptime.ackBody)}
          </p>
          ${primaryButton(ackEmailUrl, escHtml(messages.uptime.ackButton))}
        </td>
      </tr>
    </table>`;
}

function detailRow(label: string, value: string, isLast = false) {
  const paddingBottom = isLast ? "0" : "16px";
  return `
  <tr>
    <td style="padding-bottom:${paddingBottom};">
      <span style="display:block;font-size:13px;color:${COLORS.textMuted};font-weight:500;margin-bottom:4px;font-family:${FONT_STACK};">${label}</span>
      <span style="display:block;font-size:15px;color:${COLORS.textPrimary};font-weight:500;font-family:${FONT_STACK};line-height:1.4;">${value}</span>
    </td>
  </tr>`;
}

function detailsPanel(rows: string[]): string {
  if (rows.length === 0) return "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
      <tr>
        <td style="padding:18px 20px;background:${COLORS.panelBg};border-radius:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${rows.join("")}
          </table>
        </td>
      </tr>
    </table>`;
}

function wrap(body: string, messages: EmailMessages, locale: AppLocale) {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${COLORS.pageBg};padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding-bottom:16px;">
              <span style="font-size:13px;color:${COLORS.textFaint};font-weight:500;font-family:${FONT_STACK};">${escHtml(messages.wordmark)}</span>
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.cardBg};border:1px solid ${COLORS.border};border-radius:16px;padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLORS.textFaint};line-height:1.5;font-family:${FONT_STACK};">
                ${escHtml(messages.footer)}
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

function sslProblemDetailRows(messages: EmailMessages, sslResult: SslCheckResult): string[] {
  const rows: string[] = [
    detailRow(
      messages.daysRemaining,
      `${sslResult.daysUntilExpiry ?? "—"}`,
    ),
  ];
  if (sslResult.expiresAt != null) {
    rows.push(
      detailRow(messages.expires, new Date(sslResult.expiresAt).toUTCString()),
    );
  }
  return rows;
}

function finalizeDetailRows(rows: string[]): string[] {
  return rows.map((row, i) => {
    if (i === rows.length - 1) {
      return row.replace(/padding-bottom:16px/, "padding-bottom:0");
    }
    return row;
  });
}

// ─── uptime alert ─────────────────────────────────────────────────────────────

export function buildUptimeAlertHtml(
  m: Monitor,
  newStatus: boolean,
  result: RunCheckResult,
  checkedAt: string,
  messages: EmailMessages,
  locale: AppLocale,
  options?: { ackEmailUrl?: string | null; monitorDetailUrl?: string | null },
): string {
  const isUp = newStatus;
  const statusBadge = isUp
    ? badge(messages.uptime.badgeUp, COLORS.upBg, COLORS.upText, iconCheck(COLORS.upText))
    : badge(messages.uptime.badgeDown, COLORS.downBg, COLORS.downText, iconX(COLORS.downText));

  const monitorType = m.type ?? "http";
  const name = escHtml(m.name);
  let headline: string;
  if (isUp) {
    headline = emailFormat(messages.uptime.headlineUp, { name });
  } else if (monitorType === "dns") {
    headline = emailFormat(messages.uptime.headlineDownDns, { name });
  } else if (monitorType === "keyword") {
    headline = emailFormat(messages.uptime.headlineDownKeyword, { name });
  } else if (monitorType === "tcp") {
    headline = emailFormat(messages.uptime.headlineDownTcp, { name });
  } else {
    headline = emailFormat(messages.uptime.headlineDown, { name });
  }

  const rawRows: string[] = [];
  if (result.statusCode != null) {
    rawRows.push(detailRow(messages.statusCode, String(result.statusCode)));
  }
  if (result.responseTimeMs != null) {
    rawRows.push(
      detailRow(messages.responseTime, `${result.responseTimeMs} ms`),
    );
  }
  if (!isUp && result.message) {
    rawRows.push(detailRow(messages.error, escHtml(result.message)));
  }
  const rows = finalizeDetailRows(rawRows);

  const ackBlock =
    !isUp && options?.ackEmailUrl
      ? buildDownAckEmailBlock(messages, options.ackEmailUrl)
      : "";

  const monitorCta = buildMonitorDetailCtaBlock(messages, options?.monitorDetailUrl);
  const checkedAtLabel = emailFormat(messages.checkedAt, { at: escHtml(checkedAt) });
  const detailsBlock = detailsPanel(rows);

  const body = `
    <div style="margin-bottom:20px;">${statusBadge}</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:${COLORS.textPrimary};line-height:1.35;font-family:${FONT_STACK};">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;color:${COLORS.textMuted};line-height:1.5;font-family:${FONT_STACK};word-break:break-all;">${escHtml(m.url)}</p>
    ${monitorCta}
    ${ackBlock}
    ${detailsBlock}
    <p style="margin:${rows.length > 0 || ackBlock ? "20px" : "24px"} 0 0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">
      ${checkedAtLabel}
    </p>`;

  return wrap(body, messages, locale);
}

// ─── SSL alert ────────────────────────────────────────────────────────────────

export function buildSslAlertHtml(
  m: Monitor,
  sslResult: SslCheckResult,
  alertType: SslAlertType,
  checkedAt: string,
  messages: EmailMessages,
  locale: AppLocale,
  monitorDetailUrl?: string | null,
): string {
  const name = escHtml(m.name);
  let statusBadge: string;
  let headline: string;

  switch (alertType) {
    case "expiring":
      statusBadge = badge(
        messages.ssl.badgeExpiring,
        COLORS.warnBg,
        COLORS.warnText,
        iconLock(COLORS.warnText),
      );
      headline = emailFormat(messages.ssl.headlineExpiring, { name });
      break;
    case "critical":
      statusBadge = badge(
        messages.ssl.badgeCritical,
        COLORS.criticalBg,
        COLORS.criticalText,
        iconWarn(COLORS.criticalText),
      );
      headline = emailFormat(messages.ssl.headlineCritical, { name });
      break;
  }

  const rows = finalizeDetailRows(sslProblemDetailRows(messages, sslResult));
  const monitorCta = buildMonitorDetailCtaBlock(messages, monitorDetailUrl);
  const checkedAtLabel = emailFormat(messages.checkedAt, { at: escHtml(checkedAt) });
  const detailsBlock = detailsPanel(rows);

  const body = `
    <div style="margin-bottom:20px;">${statusBadge}</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:${COLORS.textPrimary};line-height:1.35;font-family:${FONT_STACK};">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;color:${COLORS.textMuted};line-height:1.5;font-family:${FONT_STACK};word-break:break-all;">${escHtml(m.url)}</p>
    ${monitorCta}
    ${detailsBlock}
    <p style="margin:${rows.length > 0 ? "20px" : "24px"} 0 0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">
      ${checkedAtLabel}
    </p>`;

  return wrap(body, messages, locale);
}

// ─── degradation alert ────────────────────────────────────────────────────────

export function buildDegradationAlertHtml(
  m: Monitor,
  recentP75Ms: number,
  baselineP75Ms: number,
  checkedAt: string,
  messages: EmailMessages,
  locale: AppLocale,
  monitorDetailUrl?: string | null,
): string {
  const ratio =
    baselineP75Ms > 0 ? (recentP75Ms / baselineP75Ms).toFixed(1) : "—";
  const statusBadge = badge(
    messages.degradation.badge,
    COLORS.warnBg,
    COLORS.warnText,
    iconWarn(COLORS.warnText),
  );

  const rawRows = [
    detailRow(messages.degradation.recentP75, `${recentP75Ms} ms`),
    detailRow(messages.degradation.baselineP75, `${baselineP75Ms} ms`),
    detailRow(
      messages.degradation.slowdown,
      `<span style="color:${COLORS.warn};font-weight:600;">${emailFormat(messages.degradation.slowdownValue, { ratio })}</span>`,
    ),
    detailRow(messages.url, escHtml(m.url)),
  ];
  const rows = finalizeDetailRows(rawRows);

  const monitorCta = buildMonitorDetailCtaBlock(messages, monitorDetailUrl);
  const checkedAtLabel = emailFormat(messages.checkedAt, { at: escHtml(checkedAt) });
  const headline = emailFormat(messages.degradation.headline, {
    name: escHtml(m.name),
  });
  const detailsBlock = detailsPanel(rows);

  const body = `
    <div style="margin-bottom:20px;">${statusBadge}</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:${COLORS.textPrimary};line-height:1.35;font-family:${FONT_STACK};">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;color:${COLORS.textMuted};line-height:1.5;font-family:${FONT_STACK};">${escHtml(messages.degradation.subhead)}</p>
    ${monitorCta}
    ${detailsBlock}
    <p style="margin:20px 0 0;font-size:12px;color:${COLORS.textFaint};font-family:${FONT_STACK};">${checkedAtLabel}</p>`;

  return wrap(body, messages, locale);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
