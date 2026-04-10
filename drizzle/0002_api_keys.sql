CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scope` text DEFAULT 'status:read' NOT NULL,
	`cors_origins` text DEFAULT '[]' NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`last_used_ip` text,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_key_prefix_unique` ON `api_key` (`key_prefix`);
--> statement-breakpoint
CREATE INDEX `api_key_user_id_idx` ON `api_key` (`user_id`);
