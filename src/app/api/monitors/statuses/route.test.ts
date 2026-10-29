import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const mocks = vi.hoisted(() => ({ db: null as unknown, getServerSession: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

import { monitor, user } from "@/db/schema";
import { GET } from "./route";

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  mocks.db = db;
  mocks.getServerSession.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  const now = new Date("2026-01-01T00:00:00Z");
  await db.insert(user).values([
    { id: "user-1", email: "a@example.com", language: "es", passwordHash: "x", role: "user", createdAt: now },
    { id: "user-2", email: "b@example.com", language: "es", passwordHash: "x", role: "user", createdAt: now },
  ]);
  const base = { url: "https://example.com", createdAt: now, type: "http" as const };
  await db.insert(monitor).values([
    { ...base, id: "up", userId: "user-1", name: "Up", currentStatus: true, lastStatusChangedAt: now },
    { ...base, id: "down", userId: "user-1", name: "Down", currentStatus: false, lastStatusChangedAt: now },
    { ...base, id: "acked", userId: "user-1", name: "Acked", currentStatus: false, lastStatusChangedAt: now, downtimeAckEpisodeAt: now },
    { ...base, id: "paused", userId: "user-1", name: "Paused", currentStatus: false, paused: true },
    { ...base, id: "new", userId: "user-1", name: "New" },
    { ...base, id: "other", userId: "user-2", name: "Not mine", currentStatus: false },
  ]);
});

describe("GET /api/monitors/statuses", () => {
  it("returns a compact status for each of the user's monitors", async () => {
    const { monitors } = await (await GET()).json();

    expect(monitors).toHaveLength(5);
    const byId = Object.fromEntries(monitors.map((m: { id: string }) => [m.id, m]));
    expect(byId.up).toEqual({ id: "up", name: "Up", status: "up", changedAt: "2026-01-01T00:00:00.000Z", acknowledged: false });
    expect(byId.down).toMatchObject({ status: "down", acknowledged: false });
    expect(byId.acked).toMatchObject({ status: "down", acknowledged: true });
    expect(byId.paused).toMatchObject({ status: "paused" });
    expect(byId.new).toMatchObject({ status: "pending", changedAt: null });
  });

  it("requires a session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});
