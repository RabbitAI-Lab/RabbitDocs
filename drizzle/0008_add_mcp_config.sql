CREATE TABLE `mcp_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `config_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
INSERT INTO `mcp_config` (`config_json`, `created_at`, `updated_at`) VALUES ('{}', datetime('now'), datetime('now'));
