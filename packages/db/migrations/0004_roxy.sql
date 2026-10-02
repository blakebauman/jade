CREATE TABLE `roxy_current` (
	`child_id` text PRIMARY KEY NOT NULL,
	`look_json` text NOT NULL,
	`worn_look_id` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worn_look_id`) REFERENCES `roxy_looks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `roxy_looks` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`look_json` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roxy_looks_fingerprint_unique` ON `roxy_looks` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `roxy_looks_child_idx` ON `roxy_looks` (`child_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `roxy_unlocks` (
	`child_id` text NOT NULL,
	`item_id` text NOT NULL,
	`cost` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`child_id`, `item_id`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `child_stats` ADD `stars_spent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `parent_settings` ADD `roxy_holidays_off` text DEFAULT '[]' NOT NULL;