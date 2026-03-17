import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const monitor = sqliteTable("monitor", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  intervalMinutes: integer("interval_minutes").notNull().default(5),
  timeoutSeconds: integer("timeout_seconds").notNull().default(15),
  method: text("method", { enum: ["GET", "HEAD"] }).notNull().default("GET"),
  expectedStatusCodes: text("expected_status_codes").notNull().default("200-299"),
  lastCheckAt: integer("last_check_at", { mode: "timestamp" }),
  currentStatus: integer("current_status", { mode: "boolean" }),
  lastStatusChangedAt: integer("last_status_changed_at", { mode: "timestamp" }),
  alertEmail: integer("alert_email", { mode: "boolean" }),
  alertEmailTo: text("alert_email_to"),
  sslMonitoring: integer("ssl_monitoring", { mode: "boolean" }),
  sslValid: integer("ssl_valid", { mode: "boolean" }),
  sslExpiresAt: integer("ssl_expires_at", { mode: "timestamp" }),
  sslLastCheckedAt: integer("ssl_last_checked_at", { mode: "timestamp" }),
  showOnStatusPage: integer("show_on_status_page", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const checkResult = sqliteTable("check_result", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id")
    .notNull()
    .references(() => monitor.id, { onDelete: "cascade" }),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  message: text("message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Monitor = typeof monitor.$inferSelect;
export type NewMonitor = typeof monitor.$inferInsert;
export type CheckResult = typeof checkResult.$inferSelect;
export type NewCheckResult = typeof checkResult.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
