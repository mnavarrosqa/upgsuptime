import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const monitorRows: unknown[][] = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(monitorRows.shift() ?? [])),
      })),
    })),
  };

  return {
    db,
    getServerSession: vi.fn(),
    isMaintenanceActive: vi.fn(),
    monitorRows,
    runCheck: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/run-check", () => ({ runCheck: mocks.runCheck }));
vi.mock("@/lib/monitor-config", () => ({ isMaintenanceActive: mocks.isMaintenanceActive }));

describe("POST /api/monitors/[id]/check-now", () => {
  beforeEach(() => {
    mocks.monitorRows.length = 0;
    mocks.db.select.mockClear();
    mocks.getServerSession.mockReset();
    mocks.isMaintenanceActive.mockReset().mockReturnValue(false);
    mocks.runCheck.mockReset().mockResolvedValue({
      monitorId: "monitor-1",
      ok: true,
      responseTimeMs: 42,
      statusCode: 200,
    });
  });

  it("requires an authenticated user", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "monitor-1" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.runCheck).not.toHaveBeenCalled();
  });

  it("returns not found for monitors outside the user's ownership", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.com" },
    });
    mocks.monitorRows.push([]);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "monitor-1" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(response.status).toBe(404);
    expect(mocks.runCheck).not.toHaveBeenCalled();
  });

  it("runs a manual check with maintenance state for owned monitors", async () => {
    const ownedMonitor = { id: "monitor-1", userId: "user-1", name: "Site" };
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.com" },
    });
    mocks.monitorRows.push([ownedMonitor]);
    mocks.isMaintenanceActive.mockReturnValue(true);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "monitor-1" }),
    });

    await expect(response.json()).resolves.toEqual({
      monitorId: "monitor-1",
      ok: true,
      responseTimeMs: 42,
      statusCode: 200,
    });
    expect(response.status).toBe(200);
    expect(mocks.isMaintenanceActive).toHaveBeenCalledWith(ownedMonitor);
    expect(mocks.runCheck).toHaveBeenCalledWith(ownedMonitor, "owner@example.com", {
      maintenanceActive: true,
      manual: true,
    });
  });

  it("returns check failure details when the manual check throws", async () => {
    const ownedMonitor = { id: "monitor-1", userId: "user-1", name: "Site" };
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.com" },
    });
    mocks.monitorRows.push([ownedMonitor]);
    mocks.runCheck.mockRejectedValue(new Error("connection refused"));
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "monitor-1" }),
    });

    await expect(response.json()).resolves.toEqual({
      error: "Check failed",
      message: "connection refused",
    });
    expect(response.status).toBe(500);
  });
});
