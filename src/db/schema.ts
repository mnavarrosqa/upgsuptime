import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  language: text("language", { enum: ["en", "es"] }).notNull().default("en"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  activityClearedAt: integer("activity_cleared_at", { mode: "timestamp" }),
  /** JSON array of dismissed activity event ids (check_result.id or degradation_alert_event.id). */
  activityDismissedIds: text("activity_dismissed_ids"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }),
  onboardingStep: text("onboarding_step"),
  /** Optional headline on /status/[username]; falls back to username. */
  statusPageTitle: text("status_page_title"),
  /** Optional subtitle under the title on the public status page. */
  statusPageTagline: text("status_page_tagline"),
  /** When true, show the default product footer on the public status page. */
  statusPageShowPoweredBy: integer("status_page_show_powered_by", {
    mode: "boolean",
  }).default(true),
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
  /** Copy of lastStatusChangedAt when user acks current down episode; cleared on recovery. */
  downtimeAckEpisodeAt: integer("downtime_ack_episode_at", { mode: "timestamp" }),
  alertEmail: integer("alert_email", { mode: "boolean" }),
  alertEmailTo: text("alert_email_to"),
  sslMonitoring: integer("ssl_monitoring", { mode: "boolean" }),
  sslValid: integer("ssl_valid", { mode: "boolean" }),
  sslExpiresAt: integer("ssl_expires_at", { mode: "timestamp" }),
  sslLastCheckedAt: integer("ssl_last_checked_at", { mode: "timestamp" }),
  showOnStatusPage: integer("show_on_status_page", { mode: "boolean" }),
  paused: integer("paused", { mode: "boolean" }),
  consecutiveFailures: integer("consecutive_failures"),
  type: text("type", { enum: ["http", "keyword", "dns"] }).notNull().default("http"),
  keywordContains: text("keyword_contains"),
  keywordShouldExist: integer("keyword_should_exist", { mode: "boolean" }).default(true),
  dnsRecordType: text("dns_record_type"),
  dnsExpectedValue: text("dns_expected_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  // Degradation alert feature
  degradationAlertEnabled: integer("degradation_alert_enabled", { mode: "boolean" }),
  baselineP75Ms: integer("baseline_p75_ms"),
  baselineSampleCount: integer("baseline_sample_count"),
  consecutiveDegradedChecks: integer("consecutive_degraded_checks"),
  degradingAlertSentAt: integer("degrading_alert_sent_at", { mode: "timestamp" }),
  baselineResetAt: integer("baseline_reset_at", { mode: "timestamp" }),
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

/** Logged when a degradation threshold is crossed (same moment as degradingAlertSentAt is set). */
export const degradationAlertEvent = sqliteTable("degradation_alert_event", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id")
    .notNull()
    .references(() => monitor.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  recentAvgMs: integer("recent_avg_ms").notNull(),
  baselineP75Ms: integer("baseline_p75_ms").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const apiKey = sqliteTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull().unique(),
  keyHash: text("key_hash").notNull(),
  scope: text("scope", { enum: ["status:read"] }).notNull().default("status:read"),
  corsOrigins: text("cors_origins").notNull().default("[]"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  lastUsedIp: text("last_used_ip"),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Monitor = typeof monitor.$inferSelect;
export type NewMonitor = typeof monitor.$inferInsert;
export type CheckResult = typeof checkResult.$inferSelect;
export type NewCheckResult = typeof checkResult.$inferInsert;
export type DegradationAlertEvent = typeof degradationAlertEvent.$inferSelect;
export type NewDegradationAlertEvent = typeof degradationAlertEvent.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type ApiKey = typeof apiKey.$inferSelect;
export type NewApiKey = typeof apiKey.$inferInsert;
