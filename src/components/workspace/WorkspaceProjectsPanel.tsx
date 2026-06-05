"use client";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "antd";

interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
}

interface WorkspaceProjectsPanelProps {
  workspaceId: string;
  workspaceName: string;
  accountType: string;
  accountId: string;
  initialProjects: ProjectMeta[];
  onWorkspaceDeleted: () => void;
}

export default function WorkspaceProjectsPanel({
  workspaceId,
  workspaceName,
  accountType,
  accountId,
  initialProjects,
  onWorkspaceDeleted,
}: WorkspaceProjectsPanelProps) {
  const router = useRouter();
  const t = useTranslations('workspace');
  const [projects, setProjects] = useState<ProjectMeta[]>(initialProjects);
  const { authFetch } = useAuth();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<ProjectMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStep2, setDeleteStep2] = useState(false);

  const refreshProjects = useCallback(async () => {
    const res = await authFetch(
      `/api/fs/workspaces/projects?type=${accountType}&accountId=${accountId}&workspace=${workspaceId}`,
    );
    const data = await res.json();
    setProjects(data);
  }, [accountType, accountId, workspaceId, authFetch]);

  const handleOpenAddProject = async () => {
    const res = await authFetch(
      `/api/fs/projects?type=${accountType}&accountId=${accountId}`,
    );
    const allProjects: ProjectMeta[] = await res.json();
    const linkedIds = new Set(projects.map((p) => p.id));
    const available = allProjects.filter((p) => !linkedIds.has(p.id));
    setAvailableProjects(available);
    setSelectedIds(new Set());
    setAddModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchAdd = async () => {
    setAdding(true);
    for (const projectId of selectedIds) {
      await authFetch("/api/fs/workspaces/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: accountType,
          accountId,
          workspace: workspaceId,
          projectId,
        }),
      });
    }
    setAdding(false);
    setAddModalOpen(false);
    refreshProjects();
  };

  const handleRemoveProject = async (projectId: string) => {
    await authFetch("/api/fs/workspaces/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: accountType,
        accountId,
        workspace: workspaceId,
        projectId,
      }),
    });
    setConfirmRemoveId(null);
    refreshProjects();
  };

  const handleDeleteWorkspace = async () => {
    await authFetch("/api/fs/workspaces", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: accountType, accountId, id: workspaceId }),
    });
    onWorkspaceDeleted();
  };

  const nameMatches = deleteConfirmName.trim() === workspaceName;

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleOpenAddProject}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('projects.addExistingProject')}
        </button>
      </div>

      {/* Add project modal */}
      <Modal
        title={t('projects.addTitle')}
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleBatchAdd}
        okText={t('projects.add')}
        cancelText={t('projects.cancel')}
        okButtonProps={{ disabled: selectedIds.size === 0 }}
        confirmLoading={adding}
        destroyOnHidden
        width={520}
      >
        {availableProjects.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {t('projects.noProjectsToAdd')}
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {availableProjects.map((p) => {
              const checked = selectedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelect(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSelect(p.id);
                    }
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none ${
                    checked ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300"
                    }`}
                  >
                    {checked && (
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-blue-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm truncate">{p.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Projects list */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {t('projects.projectsCount', { count: projects.length })}
        </h3>
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm text-gray-400">{t('projects.noLinkedProjects')}</p>
            <p className="text-xs text-gray-300 mt-1">
              {t('projects.clickToAdd')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <button
                  onClick={() =>
                    router.push(
                      `/project/${accountType}/${accountId}/projects/${project.id}`,
                    )
                  }
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-blue-600 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {project.description || t('projects.noDescription')}
                    </div>
                  </div>
                </button>
                <span className="relative">
                  <button
                    onClick={() =>
                      setConfirmRemoveId(
                        confirmRemoveId === project.id ? null : project.id,
                      )
                    }
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title={t('projects.removeLink')}
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
                  {confirmRemoveId === project.id && (
                    <span className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                      <span className="text-gray-500">{t('projects.removeLinkConfirm')}</span>
                      <button
                        onClick={() => handleRemoveProject(project.id)}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        {t('projects.remove')}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700"
                      >
                        {t('projects.cancel')}
                      </button>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone - delete workspace */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        {!showDeleteZone ? (
          <button
            onClick={() => setShowDeleteZone(true)}
            className="text-sm text-red-400 hover:text-red-600 transition-colors"
          >
            {t('projects.deleteWorkspace')}
          </button>
        ) : !deleteStep2 ? (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 mb-3">
              {t('projects.deleteConfirm', { name: workspaceName })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteStep2(true)}
                className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                {t('projects.continueDelete')}
              </button>
              <button
                onClick={() => {
                  setShowDeleteZone(false);
                  setDeleteConfirmName("");
                  setDeleteStep2(false);
                }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              >
                {t('projects.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 mb-3">
              {t('projects.enterNameToConfirm', { name: workspaceName })}
            </p>
            <input
              autoFocus
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameMatches) handleDeleteWorkspace();
                if (e.key === "Escape") {
                  setShowDeleteZone(false);
                  setDeleteConfirmName("");
                  setDeleteStep2(false);
                }
              }}
              placeholder={workspaceName}
              className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:border-red-500 bg-white mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteWorkspace}
                disabled={!nameMatches}
                className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {t('projects.confirmDelete')}
              </button>
              <button
                onClick={() => {
                  setShowDeleteZone(false);
                  setDeleteConfirmName("");
                  setDeleteStep2(false);
                }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              >
                {t('projects.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

