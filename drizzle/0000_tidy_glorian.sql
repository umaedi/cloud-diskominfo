CREATE TABLE `uploaded_images` (
	`id` varchar(36) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`original_size` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`format` varchar(20) NOT NULL,
	`quality` int NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`bucket` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploaded_images_id` PRIMARY KEY(`id`)
);
