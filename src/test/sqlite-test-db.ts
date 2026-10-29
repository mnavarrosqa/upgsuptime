import { execFileSync } from "child_process";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

let schemaSql: string | undefined;

/**
 * DDL for the current schema. `drizzle-kit export` runs in a child process on
 * purpose: loading drizzle-kit in the test runtime installs module hooks that
 * make later `import("@/db")` calls bypass `vi.mock`.
 */
function currentSchemaSql(): string {
  schemaSql ??= execFileSync(
    process.execPath,
    [path.resolve(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "export"],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return schemaSql;
}

/**
 * Fresh in-memory SQLite database with the current schema, for tests that need
 * real queries. Use with `vi.mock("@/db", ...)`.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(currentSchemaSql());
  return drizzle(sqlite, { schema });
}

export type TestDb = ReturnType<typeof createTestDb>;
