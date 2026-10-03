CREATE TABLE `ticket_earnings` (
	`child_id` text NOT NULL,
	`key` text NOT NULL,
	`tickets` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`child_id`, `key`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
