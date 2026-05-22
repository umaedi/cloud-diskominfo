CREATE TABLE `fcm_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`fcm_token` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fcm_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`fcm_token` text,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`image` text,
	`url` text,
	`scheduled_at` timestamp NOT NULL DEFAULT (now()),
	`is_multicast` boolean NOT NULL DEFAULT false,
	`screen` varchar(255) NOT NULL DEFAULT 'BeritaScreen',
	`read` int NOT NULL DEFAULT 0,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
