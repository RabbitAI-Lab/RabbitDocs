CREATE TABLE IF NOT EXISTS `shared_html_files` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `project_id` text NOT NULL,
  `html_path` text NOT NULL,
  `token` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `shared_html_files_token_unique` ON `shared_html_files` (`token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_shared_html_files_project_path` ON `shared_html_files` (`project_id`,`html_path`);
