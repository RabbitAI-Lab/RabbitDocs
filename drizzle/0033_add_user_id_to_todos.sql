ALTER TABLE `todos` ADD COLUMN `user_id` text;
DELETE FROM `todos` WHERE `user_id` IS NULL;
