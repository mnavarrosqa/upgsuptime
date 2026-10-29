import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Monitor } from "@/db/schema";
import type { MonitorOwner } from "@/lib/monitor-owner";

const mocks = vi.hoisted(() => {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push(values);
        return { where: vi.fn(async () => {}) };
      }),
    })),
  };

  return {
    db,
    inserts,
    updates,
    fetch: vi.fn(),
    connector: vi.fn(),
    dnsLookup: vi.fn(),
    dnsResolve: vi.fn(),
    checkUrlAllowed: vi.fn(),
    checkSSL: vi.fn(),
    sendNotifications: vi.fn(),
    sendSslNotifications: vi.fn(),
    evaluateDegradation: vi.fn(),
    sendDegradationAlert: vi.fn(),
    sendMonitorStatusPush: vi.fn(),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<typeof import("undici")>()),
  fetch: mocks.fetch,
  buildConnector: () => mocks.connector,
}));
vi.mock("dns/promises", () => ({ lookup: mocks.dnsLookup, resolve: mocks.dnsResolve }));
vi.mock("@/lib/url-allowed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/url-allowed")>()),
  checkUrlAllowed: mocks.checkUrlAllowed,
}));
vi.mock("@/lib/check-ssl", () => ({ checkSSL: mocks.checkSSL }));
vi.mock("@/lib/notify", () => ({
  sendNotifications: mocks.sendNotifications,
  sendSslNotifications: mocks.sendSslNotifications,
}));
vi.mock("@/lib/push", () => ({ sendMonitorStatusPush: mocks.sendMonitorStatusPush }));
vi.mock("@/lib/degradation", () => ({
  evaluateDegradation: mocks.evaluateDegradation,
  sendDegradationAlert: mocks.sendDegradationAlert,
}));

import { createInstrumentedConnect, runCheck } from "./run-check";
import type { PhaseTimings } from "./run-check";
import { checkResult, degradationAlertEvent } from "@/db/schema";

const owner: MonitorOwner = { email: "owner@example.com", language: "en" };
const DAY_MS = 24 * 60 * 60 * 1000;

function buildMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: "monitor-1",
    userId: "user-1",
    name: "Site",
    url: "https://example.com/health",
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
    currentStatus: true,
    lastStatusChangedAt: null,
    downtimeAckEpisodeAt: null,
    alertEmail: true,
    alertEmailTo: null,
    sslMonitoring: false,
    sslValid: null,
    sslExpiresAt: null,
    sslLastCheckedAt: null,
    showOnStatusPage: true,
    paused: false,
    consecutiveFailures: 0,
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    degradationAlertEnabled: false,
    baselineP75Ms: null,
    baselineSampleCount: null,
    consecutiveDegradedChecks: null,
    degradingAlertSentAt: null,
    baselineResetAt: null,
    ...overrides,
  };
}

/** Drives fake timers until the promise settles (retries wait between attempts). */
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true),
  );
  while (!done) await vi.advanceTimersByTimeAsync(1000);
  return promise;
}

function check(m: Monitor, opts: Parameters<typeof runCheck>[2] = {}) {
  return settle(runCheck(m, owner, { maintenanceActive: false, ...opts }));
}

function lastUpdate() {
  return mocks.updates.at(-1) ?? {};
}

function checkResultRows() {
  return mocks.inserts.filter((i) => i.table === checkResult).map((i) => i.values);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  mocks.inserts.length = 0;
  mocks.updates.length = 0;
  for (const fn of [
    mocks.fetch,
    mocks.connector,
    mocks.dnsLookup,
    mocks.dnsResolve,
    mocks.checkUrlAllowed,
    mocks.checkSSL,
    mocks.sendNotifications,
    mocks.sendSslNotifications,
    mocks.evaluateDegradation,
    mocks.sendDegradationAlert,
    mocks.sendMonitorStatusPush,
  ]) {
    fn.mockReset();
  }
  mocks.checkUrlAllowed.mockResolvedValue({ allowed: true, resolvedHost: "93.184.216.34" });
  mocks.fetch.mockImplementation(async () => new Response("ok", { status: 200 }));
  mocks.sendNotifications.mockResolvedValue(undefined);
  mocks.sendSslNotifications.mockResolvedValue(undefined);
  mocks.sendDegradationAlert.mockResolvedValue(undefined);
  mocks.sendMonitorStatusPush.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runCheck status state machine", () => {
  it("marks a new monitor up on its first success without alerting", async () => {
    const result = await check(buildMonitor({ currentStatus: null }));

    expect(result).toMatchObject({ ok: true, statusCode: 200, attempts: 1 });
    expect(lastUpdate()).toMatchObject({ currentStatus: true, consecutiveFailures: 0 });
    expect(mocks.sendNotifications).not.toHaveBeenCalled();
  });

  it("sends a recovery alert and clears the downtime ack when a down monitor recovers", async () => {
    await check(buildMonitor({ currentStatus: false, consecutiveFailures: 4 }));

    expect(lastUpdate()).toMatchObject({
      currentStatus: true,
      consecutiveFailures: 0,
      downtimeAckEpisodeAt: null,
    });
    expect(mocks.sendNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ id: "monitor-1" }),
      true,
      expect.objectContaining({ ok: true }),
      "owner@example.com",
      "en",
      { downEpisodeAt: undefined },
    );
    expect(mocks.sendMonitorStatusPush).toHaveBeenCalledWith(
      expect.objectContaining({ id: "monitor-1" }),
      true,
      expect.objectContaining({ ok: true }),
      "en",
    );
  });

  it("retries a failing check and waits for confirmation before going down", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 503 }));

    const result = await check(buildMonitor({ currentStatus: true, consecutiveFailures: 0 }));

    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ ok: false, statusCode: 503, attempts: 3, message: "Service Unavailable" });
    expect(lastUpdate()).toMatchObject({ consecutiveFailures: 1 });
    expect(lastUpdate()).not.toHaveProperty("currentStatus");
    expect(mocks.sendNotifications).not.toHaveBeenCalled();
  });

  it("transitions to down and alerts on the confirming failure", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));

    await check(buildMonitor({ currentStatus: true, consecutiveFailures: 1 }));

    expect(lastUpdate()).toMatchObject({ currentStatus: false, consecutiveFailures: 2 });
    expect(mocks.sendNotifications).toHaveBeenCalledWith(
      expect.anything(),
      false,
      expect.objectContaining({ ok: false }),
      "owner@example.com",
      "en",
      { downEpisodeAt: expect.any(Date) },
    );
  });

  it("does not alert again for a monitor that is already down", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));

    await check(buildMonitor({ currentStatus: false, consecutiveFailures: 5 }));

    expect(lastUpdate()).toMatchObject({ consecutiveFailures: 6 });
    expect(lastUpdate()).not.toHaveProperty("currentStatus");
    expect(mocks.sendNotifications).not.toHaveBeenCalled();
  });

  it("only marks a new monitor down without alerting", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));

    await check(buildMonitor({ currentStatus: null, consecutiveFailures: 1 }));

    expect(lastUpdate()).toMatchObject({ currentStatus: false });
    expect(mocks.sendNotifications).not.toHaveBeenCalled();
  });

  it("records the transition but suppresses alerts during maintenance", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));

    const result = await check(
      buildMonitor({ currentStatus: true, consecutiveFailures: 1, maintenanceNote: "DB upgrade" }),
      { maintenanceActive: true },
    );

    expect(lastUpdate()).toMatchObject({ currentStatus: false });
    expect(mocks.sendNotifications).not.toHaveBeenCalled();
    expect(mocks.sendMonitorStatusPush).not.toHaveBeenCalled();
    expect(result.message).toBe("Internal Server Error");
    expect(checkResultRows()[0]).toMatchObject({ duringMaintenance: true });
  });

  it("labels successful checks during maintenance", async () => {
    const scheduled = await check(buildMonitor({ maintenanceNote: "DB upgrade" }), { maintenanceActive: true });
    const manual = await check(buildMonitor(), { maintenanceActive: true, manual: true });

    expect(scheduled.message).toBe("DB upgrade");
    expect(manual.message).toBe("Manual check during maintenance window");
  });

  it("stores the check result row", async () => {
    await check(buildMonitor());

    expect(checkResultRows()).toEqual([
      expect.objectContaining({
        monitorId: "monitor-1",
        ok: true,
        statusCode: 200,
        attempts: 1,
        message: null,
        duringMaintenance: null,
      }),
    ]);
  });
});

describe("runCheck HTTP requests", () => {
  it.each([
    ["200,301-302", 302, true],
    ["200,301-302", 301, true],
    ["200,301-302", 304, false],
    ["204", 204, true],
    ["", 250, true],
  ])("expected codes %j with status %i → ok=%s", async (expectedStatusCodes, status, ok) => {
    mocks.fetch.mockImplementation(async () => new Response(null, { status }));

    const result = await check(buildMonitor({ expectedStatusCodes }));

    expect(result.ok).toBe(ok);
  });

  it("reports network errors as the check message", async () => {
    mocks.fetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await check(buildMonitor());

    expect(result).toMatchObject({ ok: false, message: "connect ECONNREFUSED", attempts: 3 });
    expect(result.statusCode).toBeUndefined();
  });

  it("does not fetch or check SSL when the URL is not allowed", async () => {
    mocks.checkUrlAllowed.mockResolvedValue({ allowed: false, reason: "URL resolves to a disallowed address" });

    const result = await check(buildMonitor({ sslMonitoring: true }));

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.checkSSL).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, message: "URL resolves to a disallowed address" });
  });

  it("sends custom headers, a JSON body and redirect settings", async () => {
    await check(
      buildMonitor({
        method: "POST",
        requestHeaders: JSON.stringify([{ name: "Authorization", value: "Bearer t" }]),
        requestBody: '{"ping":true}',
        requestBodyType: "json",
        followRedirects: false,
        maxRedirects: 99,
      }),
    );

    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://example.com/health");
    expect(init).toMatchObject({
      method: "POST",
      body: '{"ping":true}',
      redirect: "manual",
      maxRedirections: 20,
      headers: {
        "User-Agent": "UPGMonitor/1.0",
        Authorization: "Bearer t",
        "Content-Type": "application/json",
      },
    });
  });

  it("keeps a user-supplied content type and never sends a body with GET", async () => {
    await check(
      buildMonitor({
        method: "PUT",
        requestHeaders: JSON.stringify([{ name: "content-type", value: "text/csv" }]),
        requestBody: "a,b",
        requestBodyType: "json",
      }),
    );
    await check(buildMonitor({ method: "GET", requestBody: "ignored", requestBodyType: "text" }));

    const [, putInit] = mocks.fetch.mock.calls[0];
    expect(putInit.headers).toEqual({ "User-Agent": "UPGMonitor/1.0", "Content-Type": "text/csv" });
    const [, getInit] = mocks.fetch.mock.calls[1];
    expect(getInit.body).toBeUndefined();
  });
});

describe("runCheck keyword monitors", () => {
  function keywordMonitor(overrides: Partial<Monitor> = {}) {
    return buildMonitor({ type: "keyword", keywordContains: "All Systems Go", ...overrides });
  }

  it("passes when the keyword is present, ignoring case", async () => {
    mocks.fetch.mockImplementation(async () => new Response("<h1>all systems go</h1>"));

    const result = await check(keywordMonitor());

    expect(result).toMatchObject({ ok: true, attempts: 1 });
  });

  it("fails when the keyword is missing", async () => {
    mocks.fetch.mockImplementation(async () => new Response("<h1>maintenance</h1>"));

    const result = await check(keywordMonitor());

    expect(result).toMatchObject({ ok: false, message: 'Keyword "All Systems Go" not found in response' });
  });

  it("fails when a keyword that should be absent is present", async () => {
    mocks.fetch.mockImplementation(async () => new Response("Fatal error: all systems go"));

    const result = await check(keywordMonitor({ keywordShouldExist: false }));

    expect(result).toMatchObject({
      ok: false,
      message: 'Keyword "All Systems Go" found in response (expected absent)',
    });
  });

  it("fails on an unexpected status even when the keyword matches", async () => {
    mocks.fetch.mockImplementation(async () => new Response("all systems go", { status: 502 }));

    const result = await check(keywordMonitor());

    expect(result).toMatchObject({ ok: false, statusCode: 502, message: "Bad Gateway" });
  });
});

describe("runCheck DNS monitors", () => {
  function dnsMonitor(overrides: Partial<Monitor> = {}) {
    return buildMonitor({ type: "dns", url: "example.com", dnsRecordType: "A", dnsExpectedValue: "93.184.216.34", ...overrides });
  }

  it("passes when a record matches exactly", async () => {
    mocks.dnsResolve.mockResolvedValue(["1.2.3.4", "93.184.216.34"]);

    const result = await check(dnsMonitor());

    expect(mocks.dnsResolve).toHaveBeenCalledWith("example.com", "A");
    expect(result.ok).toBe(true);
    expect(mocks.checkSSL).not.toHaveBeenCalled();
  });

  it("matches TXT records by substring across chunks", async () => {
    mocks.dnsResolve.mockResolvedValue([["v=spf1 include:", "_spf.example.com ~all"]]);

    const result = await check(dnsMonitor({ dnsRecordType: "TXT", dnsExpectedValue: "include:_spf.example.com" }));

    expect(result.ok).toBe(true);
  });

  it("lists the records found when nothing matches", async () => {
    mocks.dnsResolve.mockResolvedValue([{ exchange: "MX1.Example.com", priority: 10 }]);

    const result = await check(dnsMonitor({ dnsRecordType: "MX", dnsExpectedValue: "mx2.example.com" }));

    expect(result).toMatchObject({
      ok: false,
      message: 'No MX record matches "mx2.example.com". Found: mx1.example.com',
    });
  });

  it("fails with the resolver error", async () => {
    mocks.dnsResolve.mockRejectedValue(new Error("queryA ENOTFOUND example.com"));

    const result = await check(dnsMonitor());

    expect(result).toMatchObject({ ok: false, message: "queryA ENOTFOUND example.com" });
  });
});

describe("runCheck TCP monitors", () => {
  it("refuses hosts that resolve to a disallowed address", async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    const result = await check(buildMonitor({ type: "tcp", url: "db.internal", tcpPort: 5432 }));

    expect(result).toMatchObject({ ok: false, message: "TCP host resolves to a disallowed address" });
  });
});

describe("runCheck SSL expiry alerts", () => {
  function sslResult(daysUntilExpiry: number) {
    return {
      valid: true,
      expiresAt: new Date(Date.now() + daysUntilExpiry * DAY_MS),
      daysUntilExpiry,
    };
  }

  it.each([
    [30, 6, "expiring"],
    [30, 2, "critical"],
    [5, 2, "critical"],
    [null, 5, "expiring"],
  ])("from %s to %s days left sends %s", async (oldDays, newDays, alertType) => {
    mocks.checkSSL.mockResolvedValue(sslResult(newDays));
    const sslExpiresAt = oldDays === null ? null : new Date(Date.now() + oldDays * DAY_MS);

    await check(buildMonitor({ sslMonitoring: true, sslExpiresAt }));

    expect(mocks.sendSslNotifications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ daysUntilExpiry: newDays }),
      alertType,
      "owner@example.com",
      "en",
    );
    expect(lastUpdate()).toMatchObject({ sslValid: true, sslExpiresAt: expect.any(Date) });
  });

  it("does not repeat a reminder inside the same window", async () => {
    mocks.checkSSL.mockResolvedValue(sslResult(5));

    await check(buildMonitor({ sslMonitoring: true, sslExpiresAt: new Date(Date.now() + 6 * DAY_MS) }));

    expect(mocks.sendSslNotifications).not.toHaveBeenCalled();
  });

  it("skips SSL reminders while the site is failing", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));
    mocks.checkSSL.mockResolvedValue(sslResult(1));

    await check(buildMonitor({ sslMonitoring: true, sslExpiresAt: new Date(Date.now() + 30 * DAY_MS) }));

    expect(mocks.sendSslNotifications).not.toHaveBeenCalled();
  });
});

describe("runCheck degradation alerts", () => {
  it("records and sends a degradation alert when evaluation says so", async () => {
    mocks.evaluateDegradation.mockResolvedValue({
      baselineP75Ms: 200,
      baselineSampleCount: 50,
      consecutiveDegradedChecks: 3,
      clearDegradingAlertSentAt: false,
      shouldAlert: true,
      recentP75Ms: 900,
    });

    await check(buildMonitor({ degradationAlertEnabled: true }));

    expect(lastUpdate()).toMatchObject({
      baselineP75Ms: 200,
      consecutiveDegradedChecks: 3,
      degradingAlertSentAt: expect.any(Date),
    });
    expect(mocks.inserts.find((i) => i.table === degradationAlertEvent)?.values).toMatchObject({
      recentAvgMs: 900,
      baselineP75Ms: 200,
    });
    expect(mocks.sendDegradationAlert).toHaveBeenCalledWith(expect.anything(), 900, 200, "owner@example.com", "en");
  });

  it("resets the degraded streak on failed checks", async () => {
    mocks.fetch.mockImplementation(async () => new Response("", { status: 500 }));

    await check(buildMonitor({ degradationAlertEnabled: true }));

    expect(mocks.evaluateDegradation).not.toHaveBeenCalled();
    expect(lastUpdate()).toMatchObject({ consecutiveDegradedChecks: 0 });
  });
});

describe("createInstrumentedConnect", () => {
  const pinned = { hostname: "example.com", ip: "93.184.216.34" };

  function connectTo(hostname: string, timings: PhaseTimings = {}) {
    const connect = createInstrumentedConnect(timings, pinned);
    return new Promise<{ err: Error | null }>((resolve) => {
      connect({ hostname, host: hostname, protocol: "https:", port: "443" }, (...args) => resolve({ err: args[0] }));
    });
  }

  beforeEach(() => {
    mocks.connector.mockImplementation((_opts, cb) => cb(null, {}));
  });

  it("connects the monitor's own host to the pinned IP with its SNI", async () => {
    const timings: PhaseTimings = {};
    const { err } = await connectTo("EXAMPLE.com", timings);

    expect(err).toBeNull();
    expect(mocks.dnsLookup).not.toHaveBeenCalled();
    expect(mocks.connector.mock.calls[0][0]).toMatchObject({ hostname: "93.184.216.34", servername: "example.com" });
    expect(timings.dnsMs).toBe(0);
  });

  it("reports the pre-request lookup as DNS time for the pinned host", async () => {
    const timings: PhaseTimings = {};
    const connect = createInstrumentedConnect(timings, { ...pinned, lookupMs: 12 });

    await new Promise((resolve) =>
      connect({ hostname: "example.com", host: "example.com", protocol: "https:", port: "443" }, () => resolve(null)),
    );

    expect(timings.dnsMs).toBe(12);
  });

  it("resolves a redirect target on another host instead of reusing the pinned IP", async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: "151.101.1.1", family: 4 }]);

    const { err } = await connectTo("www.example.com");

    expect(err).toBeNull();
    expect(mocks.dnsLookup).toHaveBeenCalledWith("www.example.com", { all: true });
    expect(mocks.connector.mock.calls[0][0]).toMatchObject({ hostname: "151.101.1.1", servername: "www.example.com" });
  });

  it("refuses a redirect target that resolves to a private address", async () => {
    mocks.dnsLookup.mockResolvedValue([
      { address: "151.101.1.1", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);

    const { err } = await connectTo("internal.example.net");

    expect(err?.message).toBe("Resolved IP 10.0.0.8 is not allowed (SSRF protection)");
    expect(mocks.connector).not.toHaveBeenCalled();
  });

  it("refuses a redirect to a disallowed IP literal without DNS", async () => {
    const { err } = await connectTo("[::ffff:127.0.0.1]");

    expect(err?.message).toBe("Resolved IP ::ffff:127.0.0.1 is not allowed (SSRF protection)");
    expect(mocks.dnsLookup).not.toHaveBeenCalled();
    expect(mocks.connector).not.toHaveBeenCalled();
  });

  function fakeSocket(encrypted: boolean) {
    const socket = new EventEmitter() as EventEmitter & { encrypted?: boolean };
    if (encrypted) socket.encrypted = true;
    return socket;
  }

  it("splits TCP connect time from the TLS handshake", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(130).mockReturnValueOnce(180);
    mocks.connector.mockImplementation((_opts, cb) => {
      const socket = fakeSocket(true);
      queueMicrotask(() => {
        socket.emit("connect");
        cb(null, socket);
      });
      return socket;
    });
    const timings: PhaseTimings = {};

    await connectTo("example.com", timings);

    expect(timings).toMatchObject({ connectMs: 30, tlsMs: 50 });
    now.mockRestore();
  });

  it("reports only connect time for plain HTTP", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(125).mockReturnValueOnce(125);
    mocks.connector.mockImplementation((_opts, cb) => {
      const socket = fakeSocket(false);
      queueMicrotask(() => {
        socket.emit("connect");
        cb(null, socket);
      });
      return socket;
    });
    const timings: PhaseTimings = {};

    await connectTo("example.com", timings);

    expect(timings.connectMs).toBe(25);
    expect(timings.tlsMs).toBeUndefined();
    now.mockRestore();
  });

  it("passes DNS failures through", async () => {
    mocks.dnsLookup.mockRejectedValue(new Error("getaddrinfo ENOTFOUND gone.example"));

    const { err } = await connectTo("gone.example");

    expect(err?.message).toBe("getaddrinfo ENOTFOUND gone.example");
  });
});
