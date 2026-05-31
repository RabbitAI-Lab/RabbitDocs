CREATE TABLE `sandbox_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sandbox_url` text DEFAULT 'openapi.sandbox.rabbitai-lab.com' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
INSERT INTO `sandbox_config` (`sandbox_url`, `created_at`, `updated_at`) VALUES ('openapi.sandbox.rabbitai-lab.com', datetime('now'), datetime('now'));
