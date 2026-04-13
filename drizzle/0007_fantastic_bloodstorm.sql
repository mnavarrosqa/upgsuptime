ALTER TABLE `user` ADD `status_page_title` text;--> statement-breakpoint
ALTER TABLE `user` ADD `status_page_tagline` text;--> statement-breakpoint
ALTER TABLE `user` ADD `status_page_show_powered_by` integer NOT NULL DEFAULT 1;