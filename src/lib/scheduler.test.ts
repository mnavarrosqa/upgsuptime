import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queryResults: unknown[][] = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(queryResults.shift() ?? [])),
      })),
    })),
  };

  return {
    queryResults,
    db,
    runCheck: vi.fn(),
    isMaintenanceActive: vi.fn(),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/run-check", () => ({ runCheck: mocks.runCheck }));
vi.mock("@/lib/monitor-config", () => ({ isMaintenanceActive: mocks.isMaintenanceActive }));

describe("scheduler", () => {
  beforeEach(() => {
    mocks.queryResults.length = 0;
    mocks.db.select.mockClear();
    mocks.runCheck.mockReset().mockResolvedValue(undefined);
    mocks.isMaintenanceActive.mockReset().mockReturnValue(false);
  });

  it("does not load users when no monitors are due", async () => {
    mocks.queryResults.push([]);
    const { runDueChecks } = await import("@/lib/scheduler");

    await expect(runDueChecks()).resolves.toEqual({ ran: 0 });
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
    expect(mocks.runCheck).not.toHaveBeenCalled();
  });

  it("runs due monitors with owner email and maintenance state", async () => {
    const dueMonitor = {
      id: "monitor-1",
      userId: "user-1",
      paused: false,
      intervalMinutes: 5,
      lastCheckAt: null,
    };
    mocks.queryResults.push([dueMonitor], [{ id: "user-1", email: "owner@example.com" }]);
    mocks.isMaintenanceActive.mockReturnValue(true);
    const { runDueChecks } = await import("@/lib/scheduler");

    await expect(runDueChecks()).resolves.toEqual({ ran: 1 });
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
    expect(mocks.isMaintenanceActive).toHaveBeenCalledWith(dueMonitor, expect.any(Date));
    expect(mocks.runCheck).toHaveBeenCalledWith(dueMonitor, "owner@example.com", {
      maintenanceActive: true,
    });
  });

  it("continues running due monitors when one check fails", async () => {
    const firstMonitor = {
      id: "monitor-1",
      userId: "user-1",
      paused: false,
      intervalMinutes: 5,
      lastCheckAt: null,
    };
    const secondMonitor = {
      id: "monitor-2",
      userId: "user-2",
      paused: false,
      intervalMinutes: 5,
      lastCheckAt: null,
    };
    mocks.queryResults.push(
      [firstMonitor, secondMonitor],
      [
        { id: "user-1", email: "first@example.com" },
        { id: "user-2", email: "second@example.com" },
      ]
    );
    mocks.runCheck
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce(undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runDueChecks } = await import("@/lib/scheduler");

    await expect(runDueChecks()).resolves.toEqual({ ran: 1 });
    expect(mocks.runCheck).toHaveBeenCalledTimes(2);
    expect(mocks.runCheck).toHaveBeenNthCalledWith(1, firstMonitor, "first@example.com", {
      maintenanceActive: false,
    });
    expect(mocks.runCheck).toHaveBeenNthCalledWith(2, secondMonitor, "second@example.com", {
      maintenanceActive: false,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[scheduler] check failed for monitor",
      "monitor-1",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
