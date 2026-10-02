CREATE TABLE `roxy_homes` (
	`child_id` text PRIMARY KEY NOT NULL,
	`home_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
