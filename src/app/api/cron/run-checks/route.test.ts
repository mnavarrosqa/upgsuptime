import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDueChecks: vi.fn(),
}));

vi.mock("@/lib/scheduler", () => ({ runDueChecks: mocks.runDueChecks }));

describe("GET /api/cron/run-checks", () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    mocks.runDueChecks.mockReset().mockResolvedValue({ ran: 2 });
  });

  afterEach(() => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it("rejects requests when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/cron/run-checks"));

    await expect(response.json()).resolves.toEqual({ error: "Cron endpoint not configured" });
    expect(response.status).toBe(503);
    expect(mocks.runDueChecks).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid cron secret", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/cron/run-checks", {
        headers: { "x-cron-secret": "wrong-secret" },
      })
    );

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.runDueChecks).not.toHaveBeenCalled();
  });

  it("runs due checks when the cron secret is valid", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/cron/run-checks", {
        headers: { "x-cron-secret": "test-secret" },
      })
    );

    await expect(response.json()).resolves.toEqual({ ran: 2 });
    expect(response.status).toBe(200);
    expect(mocks.runDueChecks).toHaveBeenCalledTimes(1);
  });
});
