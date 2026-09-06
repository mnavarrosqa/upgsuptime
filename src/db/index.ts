import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./uptime.db";
const dbPath = url.startsWith("file:")
  ? path.resolve(process.cwd(), url.slice(5))
  : url;
const sqlite = new Database(dbPath);
// ponytail: apply on boot so production does not wait on a separate migrate step
try {
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS check_result_monitor_created_idx ON check_result (monitor_id, created_at)"
  );
} catch {
  // table may not exist yet on first boot
}

export const db = drizzle(sqlite, { schema });
