"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentActivity } from "@/lib/types";
import type { WorkspaceMeta, ProjectMeta } from "@/lib/fs";
import WorkspaceInfoTab from "./WorkspaceInfoTab";

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
  projectId: string | null;
}

interface WorkspaceDetailProps {
  workspaceMeta: WorkspaceMeta;
  linkedProjects: ProjectMeta[];
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
  accountType: string;
  accountId: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function WorkspaceDetail({
  workspaceMeta,
  linkedProjects,
  recentChats,
  recentDocuments,
  accountType,
  accountId,
}: WorkspaceDetailProps) {
  const router = useRouter();

  // dirSegments: ["personal", "default", "workspace", "{workspaceId}"]
  // workspacePath 使用 "/" 分隔（与 projectPath 保持一致）
  const workspacePath = `${accountType}/${accountId}/workspace/${workspaceMeta.id}`;

  // 点击 Activity 标签中的 chat：跳转到 chat 所属 project 的 ProjectWorkspace
  const handleSwitchToChat = useCallback(
    (chatId: number, projectId: string | null) => {
      if (!projectId) return;
      router.push(
        `/project/${accountType}/${accountId}/projects/${projectId}?chat=${chatId}`,
      );
    },
    [router, accountType, accountId],
  );

  // 点击 New Chat：跳转到第一个 linked project 的 new chat 页面
  // （如果当前 workspace 没有 project，则不响应）
  const handleNewChat = useCallback(() => {
    if (linkedProjects.length === 0) {
      alert("This workspace has no linked projects. Please add a project first.");
      return;
    }
    const firstProject = linkedProjects[0];
    router.push(`/chat/new?project=${firstProject.id}`);
  }, [router, linkedProjects]);

  // 点击 Activity 标签中的 document：跳转到 document 所属 project 的 ProjectWorkspace
  const handleNavigateToDocument = useCallback(
    (documentPath: string, projectId: string) => {
      if (!projectId) return;
      router.push(
        `/project/${accountType}/${accountId}/projects/${projectId}?file=${encodeURIComponent(documentPath)}`,
      );
    },
    [router, accountType, accountId],
  );

  // 删除 workspace 后跳回 home
  const handleWorkspaceDeleted = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Workspace header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-indigo-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {workspaceMeta.name}
              </h2>
              <p className="text-sm text-gray-500">
                {workspaceMeta.description || "No description"}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Created {formatDate(workspaceMeta.createdAt)}
          </div>
        </div>

        {/* 7 个子标签容器 */}
        <WorkspaceInfoTab
          workspaceId={workspaceMeta.id}
          workspaceName={workspaceMeta.name}
          workspacePath={workspacePath}
          workspaceMeta={workspaceMeta}
          linkedProjects={linkedProjects}
          recentChats={recentChats}
          recentDocuments={recentDocuments}
          onSwitchToChat={handleSwitchToChat}
          onNewChat={handleNewChat}
          onNavigateToDocument={handleNavigateToDocument}
          onWorkspaceDeleted={handleWorkspaceDeleted}
          accountType={accountType}
          accountId={accountId}
        />
      </div>
    </div>
  );
}
