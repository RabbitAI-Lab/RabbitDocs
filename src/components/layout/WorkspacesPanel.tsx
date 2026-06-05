"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/components/auth/useAuth";

interface WorkspaceMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;
}

function computeDefaultName(existingWorkspaces: WorkspaceMeta[], t: (key: string) => string): string {
  const baseName = t('defaultWorkspaceName');
  const existingNames = new Set(existingWorkspaces.map((w) => w.name));
  if (!existingNames.has(baseName)) return baseName;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})`)) i++;
  return `${baseName}(${i})`;
}

export default function WorkspacesPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const { user, isLoading, authFetch } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const t = useTranslations("workspaces");

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`/api/fs/workspaces?type=personal&accountId=${user!.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch {
      setWorkspaces([]);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (isLoading || !user) {
      setWorkspaces([]);
      return;
    }
    fetchWorkspaces();
  }, [isLoading, user, fetchWorkspaces, pathname]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      await authFetch("/api/fs/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "personal", accountId: user!.id, id, name: trimmed }),
      });
    }
    setEditingId(null);
    setEditName("");
    fetchWorkspaces();
  };

  const handleCreateWorkspace = async () => {
    const name = computeDefaultName(workspaces, t);
    const res = await authFetch("/api/fs/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "personal", accountId: user!.id, name }),
    });
    if (!res.ok) return;
    const meta = await res.json();
    await fetchWorkspaces();
    setEditingId(meta.id);
    setEditName(meta.name);
    router.push(`/workspace/personal/${user!.id}/${meta.id}`);
  };

  const handleDoubleClick = (workspace: WorkspaceMeta) => {
    setEditingId(workspace.id);
    setEditName(workspace.name);
  };

  // --- Drag & Drop handlers ---

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    dragNodeRef.current = e.currentTarget;
    // Make drag ghost semi-transparent
    e.currentTarget.style.opacity = "0.4";
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = "1";
    setDragId(null);
    setDropTargetId(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (targetId === dragId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";
    setDropTargetId(targetId);
    setDropPosition(position);
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;

    // Build new order
    const withoutDrag = workspaces.filter((w) => w.id !== dragId);
    const dragItem = workspaces.find((w) => w.id === dragId)!;
    const targetIndex = withoutDrag.findIndex((w) => w.id === targetId);
    const insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
    withoutDrag.splice(insertIndex, 0, dragItem);

    // Assign new sortOrder values
    const orders = withoutDrag.map((w, i) => ({ id: w.id, sortOrder: i }));

    // Optimistic UI update
    setWorkspaces(withoutDrag.map((w, i) => ({ ...w, sortOrder: i })));

    // Persist
    await authFetch("/api/fs/workspaces", {
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
          <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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
          onClick={handleCreateWorkspace}
          className="ml-auto p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={t('newWorkspace')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="mt-0.5 space-y-0.5 px-2">
        {workspaces.map((workspace) => {
          const workspacePath = `/workspace/personal/${user!.id}/${workspace.id}`;
          const isActive = pathname === workspacePath || pathname.startsWith(workspacePath + "/");
          const isEditing = editingId === workspace.id;
          const isDragTarget = dropTargetId === workspace.id;
          const isDragging = dragId === workspace.id;

          if (isEditing) {
            return (
              <div key={workspace.id} className="flex items-center gap-2 px-3 py-1.5">
                <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(workspace.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(workspace.id);
                    if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0 text-sm border border-blue-400 rounded focus:outline-none bg-white dark:bg-zinc-800 dark:text-gray-100"
                />
              </div>
            );
          }

          return (
            <div
              key={workspace.id}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, workspace.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, workspace.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, workspace.id)}
              className={cn(
                "relative flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer select-none",
                isDragging && "opacity-40",
                !isDragging && isActive && "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 font-medium",
                !isDragging && !isActive && "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-700",
              )}
              onClick={() => router.push(workspacePath)}
            >
              {/* Drop indicator line */}
              {isDragTarget && dropPosition === "before" && (
                <div className="absolute top-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}

              <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span
                className="truncate"
                onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(workspace); }}
              >
                {workspace.name}
              </span>

              {/* Drop indicator line */}
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
