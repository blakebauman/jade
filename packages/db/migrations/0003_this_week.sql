CREATE TABLE `list_children` (
	`list_id` text NOT NULL,
	`child_id` text NOT NULL,
	PRIMARY KEY(`list_id`, `child_id`),
	FOREIGN KEY (`list_id`) REFERENCES `word_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `list_children_child_idx` ON `list_children` (`child_id`);--> statement-breakpoint
ALTER TABLE `word_lists` ADD `archived_at` integer;