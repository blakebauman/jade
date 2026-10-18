CREATE TABLE `friend_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friend_codes_user_idx` ON `friend_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `friend_links` (
	`user_a` text NOT NULL,
	`user_b` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_a`, `user_b`),
	FOREIGN KEY (`user_a`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_b`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friend_links_b_idx` ON `friend_links` (`user_b`);--> statement-breakpoint
ALTER TABLE `parent_settings` ADD `family_label` text;--> statement-breakpoint
ALTER TABLE `parent_settings` ADD `woods_guests_build` integer DEFAULT true NOT NULL;