ALTER TABLE `monitor` ADD `request_headers` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `request_body` text;--> statement-breakpoint
ALTER TABLE `monitor` ADD `request_body_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `follow_redirects` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `max_redirects` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `tcp_host` text;--> statement-breakpoint
ALTER TABLE `monitor` ADD `tcp_port` integer;--> statement-breakpoint
ALTER TABLE `monitor` ADD `maintenance_starts_at` integer;--> statement-breakpoint
ALTER TABLE `monitor` ADD `maintenance_ends_at` integer;--> statement-breakpoint
ALTER TABLE `monitor` ADD `maintenance_note` text;