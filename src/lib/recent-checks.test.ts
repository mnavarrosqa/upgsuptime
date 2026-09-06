import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: drizzle(sqlite) }));
const sqlite = new Database(":memory:");
sqlite.exec(`
  CREATE TABLE check_result (
    id TEXT PRIMARY KEY, monitor_id TEXT, ok INTEGER,
    response_time_ms INTEGER, message TEXT, created_at INTEGER
  );
  CREATE INDEX check_result_monitor_created_idx ON check_result(monitor_id, created_at);
`);
const insert = sqlite.prepare("INSERT INTO check_result VALUES (?, ?, ?, ?, ?, ?)");
for (const id of ["a", "b", "private"]) {
  for (let i = 0; i < 30; i++) insert.run(`${id}-${i}`, id, i % 2, i, null, i);
}
afterAll(() => sqlite.close());

describe("recent checks indexed retrieval", () => {
  it("returns newest checks per requested monitor with Drizzle types", async () => {
    const { getRecentChecksByMonitor } = await import("./monitor-public-status");
    for (const limit of [1, 24, 40]) {
      const rows = await getRecentChecksByMonitor(["a", "b", "missing", "a"], limit);
      expect(rows).toHaveLength(2 * Math.min(limit, 30));
      for (const id of ["a", "b"]) {
        const checks = rows.filter((r) => r.monitorId === id);
        expect(checks.map((r) => r.id)).toEqual(
          Array.from({ length: Math.min(limit, 30) }, (_, i) => `${id}-${29 - i}`)
        );
        expect(checks[0].ok).toBe(true);
        expect(checks[0].createdAt).toEqual(new Date(29_000));
        expect(checks[0].message).toBeNull();
      }
    }
  });

  it("returns no checks for empty requests or nonpositive limits", async () => {
    const { getRecentChecksByMonitor } = await import("./monitor-public-status");
    expect(await getRecentChecksByMonitor([], 24)).toEqual([]);
    expect(await getRecentChecksByMonitor(["a"], 0)).toEqual([]);
    expect(await getRecentChecksByMonitor(["a"], -1)).toEqual([]);
  });
});
