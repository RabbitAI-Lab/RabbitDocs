"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WorkspaceMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
}

interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
}

interface WorkspaceDetailProps {
  workspaceMeta: WorkspaceMeta;
  projects: ProjectMeta[];
  accountType: string;
  accountId: string;
}

export default function WorkspaceDetail({
  workspaceMeta,
  projects: initialProjects,
  accountType,
  accountId,
}: WorkspaceDetailProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>(initialProjects);
  const [showAddProject, setShowAddProject] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<ProjectMeta[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStep2, setDeleteStep2] = useState(false);

  const refreshProjects = useCallback(async () => {
    const res = await fetch(
      `/api/fs/workspaces/projects?type=${accountType}&accountId=${accountId}&workspace=${workspaceMeta.id}`,
    );
    const data = await res.json();
    setProjects(data);
  }, [accountType, accountId, workspaceMeta.id]);

  const handleOpenAddProject = async () => {
    const res = await fetch(`/api/fs/projects?type=${accountType}&accountId=${accountId}`);
    const allProjects: ProjectMeta[] = await res.json();
    const linkedIds = new Set(projects.map((p) => p.id));
    const available = allProjects.filter((p) => !linkedIds.has(p.id));
    setAvailableProjects(available);
    setShowAddProject(true);
  };

  const handleAddProject = async (projectId: string) => {
    await fetch("/api/fs/workspaces/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: accountType,
        accountId,
        workspace: workspaceMeta.id,
        projectId,
      }),
    });
    setShowAddProject(false);
    refreshProjects();
  };

  const handleRemoveProject = async (projectId: string) => {
    await fetch("/api/fs/workspaces/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: accountType,
        accountId,
        workspace: workspaceMeta.id,
        projectId,
      }),
    });
    setConfirmRemoveId(null);
    refreshProjects();
  };

  const handleDeleteWorkspace = async () => {
    await fetch("/api/fs/workspaces", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: accountType, accountId, id: workspaceMeta.id }),
    });
    router.push("/");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const nameMatches = deleteConfirmName.trim() === workspaceMeta.name;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Workspace header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{workspaceMeta.name}</h2>
              <p className="text-sm text-gray-500">{workspaceMeta.description || "暂无描述"}</p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            创建于 {formatDate(workspaceMeta.createdAt)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleOpenAddProject}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加已有项目
          </button>
        </div>

        {/* Add project modal */}
        {showAddProject && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">选择要添加的项目</h3>
              <button
                onClick={() => setShowAddProject(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {availableProjects.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">没有可添加的项目</p>
            ) : (
              <div className="space-y-1">
                {availableProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddProject(p.id)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-left"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects list */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            项目列表 ({projects.length})
          </h3>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm text-gray-400">暂无关联项目</p>
              <p className="text-xs text-gray-300 mt-1">点击上方按钮添加项目</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <button
                    onClick={() => router.push(`/project/${accountType}/${accountId}/projects/${project.id}`)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-blue-600 truncate">{project.name}</div>
                      <div className="text-xs text-gray-400 truncate">{project.description || "暂无描述"}</div>
                    </div>
                  </button>
                  <span className="relative">
                    <button
                      onClick={() => setConfirmRemoveId(confirmRemoveId === project.id ? null : project.id)}
                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="移除关联"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                    {confirmRemoveId === project.id && (
                      <span className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                        <span className="text-gray-500">移除关联?</span>
                        <button
                          onClick={() => handleRemoveProject(project.id)}
                          className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                        >移除</button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700"
                        >取消</button>
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
              删除此工作区
            </button>
          ) : !deleteStep2 ? (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 mb-3">
                确定要删除工作区 <span className="font-semibold">{workspaceMeta.name}</span> 吗？此操作不可撤销。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteStep2(true)}
                  className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  继续删除
                </button>
                <button
                  onClick={() => { setShowDeleteZone(false); setDeleteConfirmName(""); setDeleteStep2(false); }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 mb-3">
                请输入工作区名称 <span className="font-semibold font-mono bg-red-100 px-1.5 py-0.5 rounded">{workspaceMeta.name}</span> 以确认删除：
              </p>
              <input
                autoFocus
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameMatches) handleDeleteWorkspace();
                  if (e.key === "Escape") { setShowDeleteZone(false); setDeleteConfirmName(""); setDeleteStep2(false); }
                }}
                placeholder={workspaceMeta.name}
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:border-red-500 bg-white mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={!nameMatches}
                  className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  确认删除
                </button>
                <button
                  onClick={() => { setShowDeleteZone(false); setDeleteConfirmName(""); setDeleteStep2(false); }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
