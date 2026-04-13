CREATE TABLE `degradation_alert_event` (
	`id` text PRIMARY KEY NOT NULL,
	`monitor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`recent_avg_ms` integer NOT NULL,
	`baseline_p75_ms` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
