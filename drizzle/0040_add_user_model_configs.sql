-- 0040: 用户 BYOK 模型配置表 + chats 扩展
CREATE TABLE IF NOT EXISTS user_model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_name TEXT NOT NULL,
  extra_env_json TEXT NOT NULL DEFAULT '{}',
  backend TEXT NOT NULL DEFAULT 'sdk',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_model_configs_user_id ON user_model_configs(user_id);

-- chats 表新增 user_model_id 列（BYOK 模型引用，与 model_id 互斥）
ALTER TABLE chats ADD COLUMN user_model_id INTEGER REFERENCES user_model_configs(id) ON DELETE SET NULL;
