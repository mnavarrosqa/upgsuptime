CREATE TABLE `check_result` (
	`id` text PRIMARY KEY NOT NULL,
	`monitor_id` text NOT NULL,
	`status_code` integer,
	`response_time_ms` integer,
	`ok` integer NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`interval_minutes` integer DEFAULT 5 NOT NULL,
	`timeout_seconds` integer DEFAULT 15 NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`expected_status_codes` text DEFAULT '200-299' NOT NULL,
	`last_check_at` integer,
	`current_status` integer,
	`last_status_changed_at` integer,
	`alert_email` integer,
	`alert_email_to` text,
	`ssl_monitoring` integer,
	`ssl_valid` integer,
	`ssl_expires_at` integer,
	`ssl_last_checked_at` integer,
	`show_on_status_page` integer,
	`paused` integer,
	`consecutive_failures` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text,
	`language` text DEFAULT 'en' NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`activity_cleared_at` integer,
	`onboarding_completed` integer,
	`onboarding_step` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);