CREATE TABLE `child_play` (
	`child_id` text PRIMARY KEY NOT NULL,
	`free` integer DEFAULT false NOT NULL,
	`stars` integer DEFAULT false NOT NULL,
	`practice_first` integer DEFAULT false NOT NULL,
	`goal` text DEFAULT 'round' NOT NULL,
	`time_costs` integer DEFAULT false NOT NULL,
	`minutes_bought` integer DEFAULT 0 NOT NULL,
	`seconds_used` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `daily_practice` (
	`child_id` text NOT NULL,
	`day` text NOT NULL,
	`answers` integer DEFAULT 0 NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`rounds` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`child_id`, `day`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `child_stats` ADD `tickets_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `child_stats` ADD `tickets_spent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Kids who were already spending stars on Roxy keep doing so: nothing they own or were saving toward changes.
INSERT INTO `child_play` (`child_id`, `stars`) SELECT `id`, 1 FROM `children`;
--> statement-breakpoint
-- Finds made before tickets existed pay out now.
INSERT INTO `child_stats` (`child_id`, `tickets_earned`)
	SELECT `child_id`, 10 * count(*) FROM `roxy_finds` WHERE true GROUP BY `child_id`
	ON CONFLICT (`child_id`) DO UPDATE SET `tickets_earned` = excluded.`tickets_earned`;
