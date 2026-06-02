CREATE TABLE `shared_chats` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `chat_id` integer NOT NULL,
  `token` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_chats_token_unique` ON `shared_chats` (`token`);
