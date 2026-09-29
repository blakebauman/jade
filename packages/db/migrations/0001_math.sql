CREATE TABLE `skill_levels` (
	`child_id` text NOT NULL,
	`skill` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`child_id`, `skill`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `attempts` ADD `skill` text;--> statement-breakpoint
ALTER TABLE `attempts` ADD `level` integer;--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD `subject` text DEFAULT 'spelling' NOT NULL;