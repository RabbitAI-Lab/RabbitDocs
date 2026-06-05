-- 0034: 添加 entities 主表和 entity_repositories 子表
-- 将 .project.json / .workspace.json 元数据迁移到数据库

CREATE TABLE IF NOT EXISTS entities (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  account_id      TEXT NOT NULL,
  account_type    TEXT NOT NULL DEFAULT 'personal',
  owner_id        TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  gitnexus_status TEXT,
  sandbox_status  TEXT,
  skills_status   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_account ON entities(account_id, account_type, type);
CREATE INDEX IF NOT EXISTS idx_entities_owner ON entities(owner_id);

CREATE TABLE IF NOT EXISTS entity_repositories (
  id                 TEXT PRIMARY KEY,
  entity_id          TEXT NOT NULL,
  entity_type        TEXT NOT NULL,
  name               TEXT NOT NULL,
  url                TEXT NOT NULL,
  repo_type          TEXT NOT NULL DEFAULT 'other',
  credentials        TEXT NOT NULL DEFAULT '{}',
  sync_status        TEXT,
  last_sync_at       TEXT,
  last_checked_at    TEXT,
  local_commit_hash  TEXT,
  remote_commit_hash TEXT,
  error_message      TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_repos_entity ON entity_repositories(entity_id, entity_type);
