import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const mocks = vi.hoisted(() => ({ db: null as unknown, getServerSession: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));

import { checkResult, monitor, user } from "@/db/schema";
import { GET } from "./route";

let db: TestDb;
const t0 = Date.parse("2026-01-01T00:00:00Z");

/** Results whose timestamps repeat (10 per second) so paging must break ties by id. */
function results(monitorId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${monitorId}-${String(i).padStart(5, "0")}`,
    monitorId,
    ok: i % 7 !== 0,
    statusCode: 200,
    responseTimeMs: i,
    createdAt: new Date(t0 + Math.floor(i / 10) * 1000),
  }));
}

beforeEach(async () => {
  db = createTestDb();
  mocks.db = db;
  mocks.getServerSession.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  const now = new Date(t0);
  await db.insert(user).values([
    { id: "user-1", email: "a@example.com", language: "es", passwordHash: "x", role: "user", createdAt: now },
    { id: "user-2", email: "b@example.com", language: "es", passwordHash: "x", role: "user", createdAt: now },
  ]);
  const base = { url: "https://example.com", createdAt: now, type: "http" as const };
  await db.insert(monitor).values([
    { ...base, id: "big", userId: "user-1", name: "Big" },
    { ...base, id: "small", userId: "user-1", name: "Small" },
    { ...base, id: "empty", userId: "user-1", name: "Empty" },
    { ...base, id: "other", userId: "user-2", name: "Not mine" },
  ]);
  // More than two pages (page size 2000) for one monitor, with ties at page edges.
  for (const rows of [results("big", 4505), results("small", 3), results("other", 5)]) {
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(checkResult).values(rows.slice(i, i + 500));
    }
  }
});

async function exportJson(query = "") {
  const res = await GET(new Request(`http://localhost/api/user/account-export${query}`));
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="upg-account-/);
  return JSON.parse(await res.text());
}

describe("GET /api/user/account-export", () => {
  it("streams every check result of the user's monitors exactly once", async () => {
    const data = await exportJson();

    expect(data.user.email).toBe("a@example.com");
    expect(data.monitors.map((m: { id: string }) => m.id).sort()).toEqual(["big", "empty", "small"]);
    expect(data.checkResults).toHaveLength(4508);

    const ids = data.checkResults.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id: string) => id.startsWith("other-"))).toBe(false);
    expect(ids.filter((id: string) => id.startsWith("big-"))).toEqual(
      results("big", 4505).map((r) => r.id),
    );
    expect(data.checkResults.find((r: { id: string }) => r.id === "big-00007")).toEqual({
      id: "big-00007",
      monitorId: "big",
      statusCode: 200,
      responseTimeMs: 7,
      dnsMs: null,
      connectMs: null,
      tlsMs: null,
      ttfbMs: null,
      attempts: null,
      ok: false,
      message: null,
      duringMaintenance: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("leaves history out when asked", async () => {
    const data = await exportJson("?includeCheckResults=false");
    expect(data.monitors).toHaveLength(3);
    expect(data.checkResults).toEqual([]);
  });

  it("requires a session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/user/account-export"));
    expect(res.status).toBe(401);
  });
});
