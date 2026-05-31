CREATE TABLE `storage_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `storage_path` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
