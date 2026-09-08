import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const language = vi.hoisted(() => ({ locale: "es" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next-intl", () => ({
  useLocale: () => language.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/monitor-card-trend", () => ({ MonitorCardTrend: () => null }));
vi.mock("@/components/monitor-favicon", () => ({ MonitorFavicon: () => null }));
vi.mock("@/components/downtime-ack-controls", () => ({ DowntimeAckBadge: () => null }));
import { MonitorCard } from "./monitor-card";

const props = {
  id: "site", name: "Site", url: "https://example.com", latest: { ok: true, responseTimeMs: 50 },
  trendResults: [], uptimePct: 99.9, lastCheckAt: null,
  sslMonitoring: false, sslValid: null, sslExpiresAt: null,
};

afterEach(() => vi.restoreAllMocks());

describe("monitor uptime hydration", () => {
  it.each(["es", "en"])("uses the app locale %s regardless of the host default", (locale) => {
    language.locale = locale;
    const original = Number.prototype.toLocaleString;
    let hostLocale = "en-US";
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: number, requested, options) {
      return original.call(this, requested ?? hostLocale, options);
    });
    const server = renderToStaticMarkup(createElement(MonitorCard, props));
    hostLocale = "es-AR";
    const client = renderToStaticMarkup(createElement(MonitorCard, props));
    expect(client).toBe(server);
    expect(client).toContain(locale === "es" ? "99,9" : "99.9");
  });
});
