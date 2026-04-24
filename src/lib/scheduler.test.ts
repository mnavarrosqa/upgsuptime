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
});
