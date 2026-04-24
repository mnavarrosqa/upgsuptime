import { describe, expect, it } from "vitest";
import {
  isMaintenanceActive,
  parseMonitorConfigForCreate,
  parseRequestHeadersInput,
  redactRequestHeaders,
} from "@/lib/monitor-config";

describe("monitor-config", () => {
  it("preserves basic HTTP defaults", () => {
    const result = parseMonitorConfigForCreate({
      name: "Home",
      url: "https://example.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.type).toBe("http");
    expect(result.config.method).toBe("GET");
    expect(result.config.expectedStatusCodes).toBe("200-299");
    expect(result.config.requestHeaders).toBe("[]");
  });

  it("allows POST JSON checks with safe custom headers", () => {
    const result = parseMonitorConfigForCreate({
      type: "http",
      name: "API",
      url: "https://api.example.com/health",
      method: "POST",
      requestBodyType: "json",
      requestBody: '{"ping":true}',
      requestHeaders: [{ name: "Authorization", value: "Bearer secret" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.method).toBe("POST");
    expect(result.config.requestBodyType).toBe("json");
    expect(redactRequestHeaders(result.config.requestHeaders)).toEqual([
      { name: "Authorization", value: "[redacted]" },
    ]);
  });

  it("rejects managed or duplicate request headers", () => {
    expect(parseRequestHeadersInput([{ name: "Host", value: "evil.test" }]).ok).toBe(false);
    expect(
      parseRequestHeadersInput([
        { name: "X-Test", value: "one" },
        { name: "x-test", value: "two" },
      ]).ok
    ).toBe(false);
  });

  it("validates TCP checks", () => {
    const result = parseMonitorConfigForCreate({
      type: "tcp",
      name: "SMTP",
      url: "mail.example.com",
      tcpHost: "mail.example.com",
      tcpPort: 25,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.type).toBe("tcp");
    expect(result.config.tcpPort).toBe(25);
    expect(result.config.sslMonitoring).toBe(false);
  });

  it("detects active maintenance windows", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    expect(
      isMaintenanceActive(
        {
          maintenanceStartsAt: new Date("2026-01-01T11:00:00.000Z"),
          maintenanceEndsAt: new Date("2026-01-01T13:00:00.000Z"),
        },
        now
      )
    ).toBe(true);
  });
});
