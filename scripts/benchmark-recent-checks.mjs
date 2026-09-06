// Isolated synthetic benchmark; never opens the application's database.
// Run: node scripts/benchmark-recent-checks.mjs
import Database from "better-sqlite3";
import assert from "node:assert/strict";

const db = new Database(":memory:");
db.exec(`
  CREATE TABLE check_result (
    id INTEGER PRIMARY KEY, monitor_id TEXT, created_at INTEGER,
    ok INTEGER, response_time_ms INTEGER, message TEXT
  );
  CREATE INDEX check_result_monitor_created_idx ON check_result(monitor_id, created_at);
`);
const insert = db.prepare("INSERT INTO check_result VALUES (?, ?, ?, ?, ?, ?)");
const ids = Array.from({ length: 50 }, (_, i) => `m${i}`);
db.transaction(() => {
  ids.forEach((id, m) => {
    for (let i = 0; i < 10_000; i++) insert.run(m * 10_000 + i, id, i, 1, 123, null);
  });
})();
const columns = "id, monitor_id, created_at, ok, response_time_ms, message";
const ranked = db.prepare(`WITH ranked AS (
  SELECT ${columns}, row_number() OVER (PARTITION BY monitor_id ORDER BY created_at DESC) rn
  FROM check_result WHERE monitor_id IN (${ids.map(() => "?").join(",")})
) SELECT ${columns} FROM ranked WHERE rn <= ?`);
const indexed = db.prepare(`SELECT ${columns} FROM check_result
  WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ?`);
function measure(fn) {
  fn();
  const start = performance.now();
  for (let i = 0; i < 5; i++) fn();
  return Number(((performance.now() - start) / 5).toFixed(3));
}
console.log("50 monitors × 10,000 checks; warm averages over 5 runs (milliseconds)");
for (const limit of [1, 24]) {
  const before = () => ranked.all(...ids, limit);
  const after = () => ids.flatMap((id) => indexed.all(id, limit));
  const sort = (rows) => rows.sort((a, b) => a.id - b.id);
  assert.deepEqual(sort(after()), sort(before()));
  console.log({ perMonitor: limit, beforeMs: measure(before), afterMs: measure(after) });
}
console.log(db.prepare(`EXPLAIN QUERY PLAN SELECT ${columns} FROM check_result
  WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ?`).all(ids[0], 24));
db.close();
