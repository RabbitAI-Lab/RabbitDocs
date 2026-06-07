"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import WorkspaceInfoTab from "./WorkspaceInfoTab";
import type { FileTab } from "./types";
import { WORKSPACE_INFO_TAB, CHAT_TAB } from "./types";
import type { DocumentActivity } from "@/lib/types";
import type { WorkspaceMeta, ProjectMeta } from "@/lib/fs";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});

const HtmlEditor = dynamic(() => import("@/components/editor/HtmlEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});

function EditorLoading() {
  const t = useTranslations('common');
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
      {t('loadingEditor')}
    </div>
  );
}

interface WorkspaceEditorAreaProps {
  /** 当前激活的标签 ID */
  activeTabId: string;
  /** 打开的文件标签列表 */
  tabs: FileTab[];
  /** 文档路径前缀 */
  docsPath: string;

  // --- Workspace Info 相关 ---
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  workspaceMeta: WorkspaceMeta;
  linkedProjects: ProjectMeta[];
  recentChats: Array<{ id: number; title: string; updatedAt: string; projectId: string | null }>;
  recentDocuments?: DocumentActivity[];
  accountType: string;
  accountId: string;

  // --- Chat 状态 ---
  chatKey: number;
  activeChatId: number | null;
  activeChatTitle: string;
  activeChatMessages: Array<{ id: number; role: "user" | "assistant"; content: string }>;
  activeChatModelId: number | undefined;
  activeChatTemplateId: number | undefined;
  mentionFile: string | null;
  workspaceIdForChat: string;

  // --- 回调 ---
  onSwitchToChat: (chatId: number, projectId: string | null) => void;
  onNewChat: () => void;
  onNavigateToDocument: (documentPath: string, projectId: string) => void;
  onWorkspaceDeleted: () => void;
  onMentionConsumed: () => void;
  onFileSave: (filePath: string, content: string) => void;
  onFileChange: (filePath: string, content: string) => void;
  onToolCall: (event: { toolName: string; input?: Record<string, unknown> }) => void;
  /** 获取缓存的文件内容 */
  getCachedContent: (filePath: string) => string | undefined;
  /** URL 参数传入的子Tab初始值 */
  initialSubTab?: string;
}

export default function WorkspaceEditorArea({
  activeTabId,
  tabs,
  docsPath,
  workspaceId,
  workspaceName,
  workspacePath,
  workspaceMeta,
  linkedProjects,
  recentChats,
  recentDocuments,
  accountType,
  accountId,
  chatKey,
  activeChatId,
  activeChatTitle,
  activeChatMessages,
  activeChatModelId,
  activeChatTemplateId,
  mentionFile,
  workspaceIdForChat,
  onSwitchToChat,
  onNewChat,
  onNavigateToDocument,
  onWorkspaceDeleted,
  onMentionConsumed,
  onFileSave,
  onFileChange,
  onToolCall,
  getCachedContent,
  initialSubTab,
}: WorkspaceEditorAreaProps) {
  const t = useTranslations('workspace');
  return (
    <div className="flex-1 min-h-0 relative">
      {/* Workspace Info tab content */}
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{ display: activeTabId === WORKSPACE_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
      >
        <div className="px-6 py-8 w-full">
          {/* Workspace header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {workspaceMeta.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {workspaceMeta.description || t('noDescription')}
                </p>
              </div>
            </div>
          </div>

          <WorkspaceInfoTab
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            workspacePath={workspacePath}
            workspaceMeta={workspaceMeta}
            linkedProjects={linkedProjects}
            recentChats={recentChats}
            recentDocuments={recentDocuments}
            onSwitchToChat={onSwitchToChat}
            onNewChat={onNewChat}
            onNavigateToDocument={onNavigateToDocument}
            onWorkspaceDeleted={onWorkspaceDeleted}
            accountType={accountType}
            accountId={accountId}
            initialSubTab={initialSubTab}
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
          workspaceId={workspaceIdForChat}
          onBack={undefined}
          mentionFile={mentionFile}
          onMentionConsumed={onMentionConsumed}
          onToolCall={onToolCall}
          onNewChat={onNewChat}
          onSwitchToChat={(chatId) => onSwitchToChat(chatId, null)}
        />
      </div>

      {/* File editor tabs */}
      {tabs.map((tab) => (
        <div
          key={tab.filePath}
          className="absolute inset-0"
          style={{ display: activeTabId === tab.filePath ? "flex" : "none", flexDirection: "column" }}
        >
          {tab.type === "html" ? (
            <HtmlEditor
              key={tab.filePath}
              filePath={tab.filePath}
              projectId={workspaceId}
              docsPath={docsPath}
              initialValue={tab.content}
              loaded={tab.loaded}
              onSave={(content) => onFileSave(tab.filePath, content)}
              onContentChange={(content) => onFileChange(tab.filePath, content)}
            />
          ) : tab.loaded ? (
            <CherryEditor
              key={tab.filePath}
              editorId={"cherry-" + tab.filePath.replace(/\//g, "-")}
              initialValue={tab.content}
              onChange={(markdown) => onFileChange(tab.filePath, markdown)}
              onSave={() => onFileSave(tab.filePath, getCachedContent(tab.filePath) ?? tab.content)}
              defaultModel="editOnly"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
              <span className="text-sm">{t('log.loading')}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

