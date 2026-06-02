"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentActivity } from "@/lib/types";
import type { WorkspaceMeta, ProjectMeta } from "@/lib/fs";
import WorkspaceInfoTab from "./WorkspaceInfoTab";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { useFloatingChat } from "@/components/chat/FloatingChatContext";

const WORKSPACE_INFO_TAB = "__workspace_info__" as const;
const CHAT_TAB = "__chat__" as const;

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
  projectId: string | null;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  thinkingSignature?: string | null;
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
  const { open: openFloatingChat } = useFloatingChat();

  // Tab 系统
  const [activeTabId, setActiveTabId] = useState<string>(WORKSPACE_INFO_TAB);

  // Chat 状态
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("New Chat");
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();
  const [activeChatProjectId, setActiveChatProjectId] = useState<string | undefined>();

  // dirSegments: ["personal", "default", "workspace", "{workspaceId}"]
  const workspacePath = `${accountType}/${accountId}/workspace/${workspaceMeta.id}`;

  // 点击 Activity 标签中的 chat：加载会话 + 切换到 Chat Tab
  const handleSwitchToChat = useCallback(
    async (chatId: number, projectId: string | null) => {
      try {
        const [chatRes, msgRes] = await Promise.all([
          fetch(`/api/chats/${chatId}`),
          fetch(`/api/chats/${chatId}/messages`),
        ]);
        const chatData = await chatRes.json();
        const msgData = await msgRes.json();

        setActiveChatId(chatId);
        setActiveChatTitle(chatData.title || "New Chat");
        setActiveChatMessages(
          (msgData.messages || []).map((m: ChatMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
        setActiveChatModelId(chatData.modelId);
        setActiveChatTemplateId(chatData.templateId);
        setActiveChatProjectId(chatData.projectId || undefined);
        setChatKey((k) => k + 1);
        setActiveTabId(CHAT_TAB);
      } catch {
        setActiveTabId(CHAT_TAB);
      }
    },
    [],
  );

  // 点击 New Chat：重置状态 + 切换到 Chat Tab
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveChatTitle("New Chat");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setActiveChatProjectId(undefined);
    setChatKey((k) => k + 1);
    setActiveTabId(CHAT_TAB);
  }, []);

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
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-white">
      {/* Tab Bar */}
      <div className="flex items-center h-[41px] bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
        {/* Workspace Info tab */}
        <button
          onClick={() => setActiveTabId(WORKSPACE_INFO_TAB)}
          className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTabId === WORKSPACE_INFO_TAB
              ? "bg-white text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Workspace Info
        </button>

        {/* Chat tab */}
        <button
          onClick={() => setActiveTabId(CHAT_TAB)}
          className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTabId === CHAT_TAB
              ? "bg-white text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); openFloatingChat(); }}
            className="ml-0.5 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-blue-500 transition-opacity"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <path d="M21 3l-7 7" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 relative">
        {/* Workspace Info tab content */}
        <div
          className="absolute inset-0 overflow-y-auto"
          style={{ display: activeTabId === WORKSPACE_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
        >
          <div className="px-6 py-8 w-full">
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

        {/* Chat workspace */}
        <div
          className="absolute inset-0"
          style={{ display: activeTabId === CHAT_TAB ? "flex" : "none", flexDirection: "column" }}
        >
          <ChatWorkspace
            key={chatKey}
            chatId={activeChatId}
            chatTitle={activeChatTitle}
            initialMessages={activeChatMessages}
            initialModelId={activeChatModelId}
            initialTemplateId={activeChatTemplateId}
            embedded
            showProjectSelector
            projectId={activeChatProjectId}
            onBack={undefined}
            onToolCall={({ toolName }) => {
              if (toolName === "refresh_file_tree") {
                router.refresh();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
