"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/components/auth/useAuth";

interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;
}

function computeDefaultName(existingProjects: ProjectMeta[], t: (key: string) => string): string {
  const baseName = t('defaultProjectName');
  const existingNames = new Set(existingProjects.map((p) => p.name));
  if (!existingNames.has(baseName)) return baseName;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})`)) i++;
  return `${baseName}(${i})`;
}

export default function ProjectsPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const { user, isLoading, authFetch } = useAuth();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");

  const t = useTranslations("projects");

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`/api/fs/projects?type=personal&accountId=${user!.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (isLoading || !user) return;
    authFetch(`/api/fs/projects?type=personal&accountId=${user.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setProjects([]);
      });
  }, [isLoading, user, authFetch, pathname]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      await authFetch("/api/fs/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "personal", accountId: user!.id, id, name: trimmed }),
      });
    }
    setEditingId(null);
    setEditName("");
    fetchProjects();
  };

  const handleCreateProject = async () => {
    const name = computeDefaultName(projects, t);
    const res = await authFetch("/api/fs/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user!.id, name }),
    });
    if (!res.ok) return;
    const meta = await res.json();
    try { localStorage.setItem("last-selected-location", `project/${meta.id}`); } catch { /* ignore */ }
    await fetchProjects();
    setEditingId(meta.id);
    setEditName(meta.name);
    router.push(`/project/${meta.id}`);
  };

  const handleDoubleClick = (project: ProjectMeta) => {
    if (project.accountId !== user!.id) return; // 不允许重命名成员项目
    setEditingId(project.id);
    setEditName(project.name);
  };

  // --- Drag & Drop handlers ---

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    e.currentTarget.style.opacity = "0.4";
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = "1";
    setDragId(null);
    setDropTargetId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (targetId === dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTargetId(targetId);
    setDropPosition(e.clientY < midY ? "before" : "after");
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;

    const withoutDrag = projects.filter((p) => p.id !== dragId);
    const dragItem = projects.find((p) => p.id === dragId)!;
    const targetIndex = withoutDrag.findIndex((p) => p.id === targetId);
    const insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
    withoutDrag.splice(insertIndex, 0, dragItem);

    const orders = withoutDrag.map((p, i) => ({ id: p.id, sortOrder: i }));
    setProjects(withoutDrag.map((p, i) => ({ ...p, sortOrder: i })));

    await authFetch("/api/fs/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user!.id, orders }),
    });

    setDragId(null);
    setDropTargetId(null);
  };

  if (collapsed) {
    return (
      <div className="mb-1">
        <div className="flex items-center justify-center px-0 py-1.5">
          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('header')}</span>
        <button
          onClick={handleCreateProject}
          className="ml-auto p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={t('newProject')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="mt-0.5 space-y-0.5 px-2">
        {projects.map((project) => {
          const isOwned = project.accountId === user!.id;
          const projectPath = `/project/${project.id}`;
          const isActive = pathname === projectPath || pathname.startsWith(projectPath + "/");
          const isEditing = editingId === project.id;
          const isDragTarget = dropTargetId === project.id;
          const isDragging = dragId === project.id;

          if (isEditing) {
            return (
              <div key={project.id} className="flex items-center gap-2 px-3 py-1.5">
                <svg className="w-3.5 h-3.5 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(project.id);
                    if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0 text-sm border border-blue-400 rounded focus:outline-none bg-white dark:bg-zinc-800 dark:text-gray-100"
                />
              </div>
            );
          }

          return (
            <div
              key={project.id}
              draggable={!isEditing && isOwned}
              onDragStart={isOwned ? (e) => handleDragStart(e, project.id) : undefined}
              onDragEnd={isOwned ? handleDragEnd : undefined}
              onDragOver={isOwned ? (e) => handleDragOver(e, project.id) : undefined}
              onDragLeave={isOwned ? handleDragLeave : undefined}
              onDrop={isOwned ? (e) => handleDrop(e, project.id) : undefined}
              className={cn(
                "relative flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer select-none",
                isDragging && "opacity-40",
                !isDragging && isActive && "bg-gray-100 dark:bg-[#171D38] text-gray-900 dark:text-gray-100 font-medium",
                !isDragging && !isActive && "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#1E2845]",
              )}
              onClick={() => {
                try { localStorage.setItem("last-selected-location", `project/${project.id}`); } catch { /* ignore */ }
                router.push(`${projectPath}?openChat=true`);
              }}
            >
              {isDragTarget && dropPosition === "before" && (
                <div className="absolute top-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}

              <svg className="w-3.5 h-3.5 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span
                className="truncate"
                onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(project); }}
              >
                {project.name}
              </span>

              {isDragTarget && dropPosition === "after" && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
