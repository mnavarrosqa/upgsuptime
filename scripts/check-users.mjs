#!/usr/bin/env node
/**
 * Dev-only: list user emails in the DB so you can verify which account to use for login.
 * Run from project root: node scripts/check-users.mjs
 * Or with explicit DB: DATABASE_URL=file:./uptime.db node scripts/check-users.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env from project root so DATABASE_URL is set when running remotely
if (existsSync(resolve(root, ".env"))) {
  const env = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.DATABASE_URL ?? "file:./uptime.db";
const dbPath = url.startsWith("file:")
  ? resolve(root, url.slice(5))
  : url;

if (!existsSync(dbPath) && url.startsWith("file:")) {
  console.error("Database not found at", dbPath);
  console.error("Run from project root and ensure DATABASE_URL points to your DB (default: file:./uptime.db)");
  process.exit(1);
}

const db = new Database(dbPath);
let rows;
try {
  rows = db.prepare("SELECT id, email, username, role FROM user").all();
} catch {
  try {
    rows = db.prepare("SELECT id, email, role FROM user").all();
  } catch {
    rows = db.prepare("SELECT id, email FROM user").all();
    rows = rows.map((r) => ({ ...r, username: null, role: "?" }));
  }
}
db.close();

if (rows.length === 0) {
  console.log("No users in database. Create the first admin via the /setup page.");
  process.exit(0);
}

console.log("Users in database (sign in with the email below):\n");
rows.forEach((r, i) => {
  const parts = [`${i + 1}. email: ${r.email}`];
  if (r.username != null) parts.push(`username: ${r.username}`);
  if (r.role != null) parts.push(`role: ${r.role}`);
  console.log("  " + parts.join("  "));
});
console.log("\nIf login still fails, run: npm run db:push  (to sync schema, then try again)");
