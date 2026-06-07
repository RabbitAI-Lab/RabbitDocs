"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import type { FileTab, ProjectMeta, RecentChat } from "./types";
import { PROJECT_INFO_TAB, CHAT_TAB } from "./types";
import type { DocumentActivity } from "@/lib/types";

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
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-2" />
      {t('loadingEditor')}
    </div>
  );
}

interface ProjectEditorAreaProps {
  /** 当前激活的标签 ID */
  activeTabId: string;
  /** 打开的文件标签列表 */
  tabs: FileTab[];
  /** 项目信息 */
  projectId: string;
  projectName: string;
  projectPath: string;
  docsPath: string;
  projectMeta: ProjectMeta | null;
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
  /** Owner 用户信息（用于成员页显示名称） */
  ownerUser?: { name: string | null; email: string } | null;

  // --- Chat 状态 ---
  chatKey: number;
  activeChatId: number | null;
  activeChatTitle: string;
  activeChatMessages: Array<{ id: number; role: "user" | "assistant"; content: string }>;
  activeChatModelId: number | undefined;
  activeChatTemplateId: number | undefined;
  mentionFile: string | null;

  // --- 回调 ---
  onSwitchToChat: (chatId: number) => void;
  onNewChat: () => void;
  onNavigateToDocument: (documentPath: string) => void;
  onMentionConsumed: () => void;
  onFileSave: (filePath: string, content: string) => void;
  onFileChange: (filePath: string, content: string) => void;
  onToolCall: (event: { toolName: string; input?: Record<string, unknown> }) => void;
  /** 获取缓存的文件内容 */
  getCachedContent: (filePath: string) => string | undefined;
  /** URL 参数传入的子Tab初始值 */
  initialSubTab?: string;
  /** 项目信息更新回调（标题/描述变更时通知父组件） */
  onProjectUpdate?: (name: string, description: string) => void;
}

export default function ProjectEditorArea({
  activeTabId,
  tabs,
  projectId,
  projectName,
  projectPath,
  docsPath,
  projectMeta,
  recentChats,
  recentDocuments,
  ownerUser,
  chatKey,
  activeChatId,
  activeChatTitle,
  activeChatMessages,
  activeChatModelId,
  activeChatTemplateId,
  mentionFile,
  onSwitchToChat,
  onNewChat,
  onNavigateToDocument,
  onMentionConsumed,
  onFileSave,
  onFileChange,
  onToolCall,
  getCachedContent,
  initialSubTab,
  onProjectUpdate,
}: ProjectEditorAreaProps) {
  const t = useTranslations('project');

  return (
    <div className="flex-1 min-h-0 relative">
      {/* Project Info tab content */}
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{ display: activeTabId === PROJECT_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
      >
        <ProjectInfoTab
          projectId={projectId}
          projectName={projectName}
          projectMeta={projectMeta}
          projectPath={projectPath}
          recentChats={recentChats}
          recentDocuments={recentDocuments}
          ownerUser={ownerUser}
          onSwitchToChat={onSwitchToChat}
          onNewChat={onNewChat}
          onNavigateToDocument={onNavigateToDocument}
          initialSubTab={initialSubTab}
          onProjectUpdate={onProjectUpdate}
        />
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
          projectId={projectId}
          projectName={projectName}
          openFileTabs={tabs.map(t => ({
            fileName: t.filePath.split("/").pop() || t.filePath,
            filePath: t.filePath,
          }))}
          onBack={undefined}
          mentionFile={mentionFile}
          onMentionConsumed={onMentionConsumed}
          onToolCall={onToolCall}
          onNewChat={onNewChat}
          onSwitchToChat={onSwitchToChat}
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
              projectId={projectId}
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
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2" />
              <span className="text-sm">{t('loading')}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
