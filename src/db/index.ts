import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./uptime.db";
const dbPath = url.startsWith("file:")
  ? path.resolve(process.cwd(), url.slice(5))
  : url;
const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
