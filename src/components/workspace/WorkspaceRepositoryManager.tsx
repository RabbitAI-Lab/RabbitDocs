"use client";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { Input, Select, Button } from "antd";
import type { Repository, RepositoryCredentials } from "@/lib/fs";
import WorkspaceRepositorySyncStatus from "./WorkspaceRepositorySyncStatus";

interface WorkspaceRepositoryManagerProps {
  workspacePath: string;
  repositories: Repository[];
  onRepositoriesChange: (repos: Repository[]) => void;
}

interface SyncingState {
  [repoId: string]: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  github: "bg-gray-100 text-gray-700",
  gitlab: "bg-orange-100 text-orange-700",
  other: "bg-blue-100 text-blue-700",
};

export default function WorkspaceRepositoryManager({
  workspacePath,
  repositories,
  onRepositoriesChange,
}: WorkspaceRepositoryManagerProps) {
  const t = useTranslations('workspace');
  const REPO_TYPE_OPTIONS = [
    { value: "github", label: "GitHub" },
    { value: "gitlab", label: "GitLab" },
    { value: "other", label: t('repository.other') },
  ];
  const CRED_TYPE_OPTIONS = [
    { value: "none", label: t('repository.publicNoAuth') },
    { value: "token", label: t('repository.token') },
    { value: "username_password", label: t('repository.usernamePassword') },
  ];
  const TYPE_LABELS: Record<string, string> = {
    github: "GitHub",
    gitlab: "GitLab",
    other: t('repository.other'),
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const { authFetch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState<SyncingState>({});

  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formType, setFormType] = useState<"github" | "gitlab" | "other">("github");
  const [formCredType, setFormCredType] = useState<
    "none" | "token" | "username_password"
  >("none");
  const [formToken, setFormToken] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  // 修复 bug: 实际是 "/" 分隔
  const dirSegments = workspacePath.split("/").filter(Boolean);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormType("github");
    setFormCredType("none");
    setFormToken("");
    setFormUsername("");
    setFormPassword("");
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formUrl.trim()) return;

    const credentials: RepositoryCredentials = {
      type: formCredType,
      ...(formCredType === "none"
        ? {}
        : formCredType === "token"
          ? { token: formToken }
          : { username: formUsername, password: formPassword }),
    };

    const repository: Repository = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      url: formUrl.trim(),
      type: formType,
      credentials,
    };

    setSubmitting(true);
    try {
      const res = await authFetch("/api/fs/workspace-repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, repository }),
      });
      if (res.ok) {
        const updatedRepos = await res.json();
        onRepositoriesChange(updatedRepos);
        resetForm();
        setShowAddForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (repoId: string) => {
    if (!confirm(t('repository.confirmDelete'))) return;

    const res = await authFetch("/api/fs/workspace-repositories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dirSegments, repoId }),
    });
    if (res.ok) {
      onRepositoriesChange(repositories.filter((r) => r.id !== repoId));
    }
  };

  const handleSync = async (repo: Repository) => {
    const action = repo.syncStatus === "not_cloned" ? "clone" : "pull";

    setSyncingRepos((prev) => ({ ...prev, [repo.id]: true }));

    try {
      const res = await authFetch("/api/fs/workspace-repositories/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          repoId: repo.id,
          action,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedRepos = repositories.map((r) =>
          r.id === repo.id
            ? {
                ...r,
                syncStatus: data.syncStatus,
                lastSyncAt: data.success
                  ? new Date().toISOString()
                  : r.lastSyncAt,
                errorMessage: data.error,
              }
            : r,
        );
        onRepositoriesChange(updatedRepos);
      }
    } finally {
      setSyncingRepos((prev) => ({ ...prev, [repo.id]: false }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t('repository.repoCount', { count: repositories.length })}
        </p>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('repository.addRepository')}
          </button>
        )}
      </div>

      {repositories.length > 0 && (
        <div className="space-y-2">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group"
            >
              <svg
                className="w-4 h-4 text-gray-400 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {repo.name}
                  </span>
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[repo.type] || TYPE_COLORS.other}`}
                  >
                    {TYPE_LABELS[repo.type] || repo.type}
                  </span>
                  <WorkspaceRepositorySyncStatus repository={repo} />
                </div>
                <p className="text-xs text-gray-400 truncate">{repo.url}</p>
                {repo.errorMessage && (
                  <p className="text-xs text-red-500 truncate">
                    {repo.errorMessage}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSync(repo)}
                disabled={syncingRepos[repo.id]}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title={repo.syncStatus === "not_cloned" ? t('repository.clone') : t('repository.sync')}
              >
                {syncingRepos[repo.id] ? (
                  <svg
                    className="w-3 h-3 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : (
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                <span>
                  {repo.syncStatus === "not_cloned" ? t('repository.clone') : t('repository.sync')}
                </span>
              </button>
              <button
                onClick={() => handleDelete(repo.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                title={t('repository.delete')}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-gray-700">
              {t('repository.addRepoTitle')}
            </h4>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('repository.name')}</label>
              <Input
                size="small"
                placeholder={t('repository.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('repository.type')}</label>
              <Select
                size="small"
                className="w-full"
                options={REPO_TYPE_OPTIONS}
                value={formType}
                onChange={(v) => setFormType(v)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('repository.url')}</label>
            <Input
              size="small"
              placeholder={t('repository.urlPlaceholder')}
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('repository.authentication')}
            </label>
            <Select
              size="small"
              className="w-full"
              options={CRED_TYPE_OPTIONS}
              value={formCredType}
              onChange={(v) => setFormCredType(v)}
            />
          </div>

          {formCredType === "none" ? (
            <div className="text-xs text-gray-400 py-2">
              {t('repository.publicRepoHint')}
            </div>
          ) : formCredType === "token" ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('repository.token')}</label>
              <Input.Password
                size="small"
                placeholder={t('repository.tokenPlaceholder')}
                value={formToken}
                onChange={(e) => setFormToken(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t('repository.username')}
                </label>
                <Input
                  size="small"
                  placeholder="username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t('repository.password')}
                </label>
                <Input.Password
                  size="small"
                  placeholder="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="small"
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
            >
              {t('projects.cancel')}
            </Button>
            <Button
              size="small"
              loading={submitting}
              disabled={!formName.trim() || !formUrl.trim()}
              onClick={handleAdd}
            >
              {t('repository.add')}
            </Button>
          </div>
        </div>
      )}

      {repositories.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <svg
            className="w-10 h-10 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <p className="text-sm">{t('repository.noRepositories')}</p>
        </div>
      )}
    </div>
  );
}
