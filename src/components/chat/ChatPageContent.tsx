"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { App } from "antd";
import { useAuth } from "@/components/auth/useAuth";
import { useFloatingChat } from "./FloatingChatContext";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import FileTree from "@/components/ui/FileTree";
import FileTreeFooter, { type TreeViewMode } from "@/components/ui/FileTreeFooter";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import TabButton from "@/components/chat/TabButton";
import FileTreeToolbar from "@/components/chat/FileTreeToolbar";
import EditorTabContent from "@/components/chat/EditorTabContent";
import { useChatSwitching } from "./useChatSwitching";
import type { RecentChat } from "./useChatSwitching";
import { useFileTabSystem, CHAT_TAB, PROJECT_INFO_TAB } from "./useFileTabSystem";
import { useProjectFileTree } from "./useProjectFileTree";
import type { ProjectMeta as ProjectMetaType } from "@/lib/fs";
import type { DocumentActivity } from "@/lib/types";

const CHAT_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const INFO_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const FILE_ICON = (
  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const EXTERNAL_LINK_ICON = (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 3 21 3 21 9" />
    <path d="M21 3l-7 7" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

interface ChatPageContentProps {
  chatId: number;
  chatTitle: string;
  initialMessages: Array<{ id: number; role: "user" | "assistant"; content: string }>;
  initialModelId?: number;
  initialTemplateId?: number;
  projectId?: string;
  initialTree?: import("@/lib/tree").TreeNode[];
  projectName?: string;
  projectMeta?: ProjectMetaType | null;
  recentChats?: RecentChat[];
  recentDocuments?: DocumentActivity[];
}

export default function ChatPageContent({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  projectId: initialProjectId,
  initialTree: initialTreeRaw = [],
  projectName: initialProjectName,
  projectMeta: initialProjectMeta,
  recentChats: initialRecentChats,
  recentDocuments: initialRecentDocuments,
}: ChatPageContentProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const { authFetch } = useAuth();
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();

  // Project context state
  const [projectId] = useState(initialProjectId);
  const [projectName] = useState(initialProjectName);
  const [projectMeta] = useState<ProjectMetaType | null | undefined>(initialProjectMeta);
  const [recentChats] = useState(initialRecentChats);
  const [recentDocuments] = useState(initialRecentDocuments);
  const [mentionFile, setMentionFile] = useState<string | null>(null);
  const [treeView, setTreeView] = useState<TreeViewMode>("docs");

  const projectPath = projectId ? `projects/${projectId}/docs` : "";

  // Tab system
  const tabSystem = useFileTabSystem({
    projectId: projectId ?? null,
    projectPath,
    closeFallbackTab: CHAT_TAB,
  });

  // File tree
  const {
    tree: fileTreeData,
    rootTree,
    treeLoading,
    renamingPath,
    renamingName,
    setRenamingName,
    renameInputRef,
    refreshTree,
    refreshRootTree,
    handleCreateFile,
    handleCreateDir,
    handleRenameConfirm,
    handleRenameCancel,
    handleStartRename,
    handleDeleteDir,
    handleDeleteFile,
    triggerUpload,
    uploadInputRef,
    handleUploadChange,
  } = useProjectFileTree({
    projectId: projectId ?? null,
    projectPath,
    message,
    onCloseTab: tabSystem.handleTabClose,
    onUpdateTabPaths: tabSystem.updateTabPaths,
    initialTree: initialTreeRaw,
    onFileCreated: useCallback((relativePath: string, content: string) => {
      const fileType = relativePath.toLowerCase().endsWith(".html") ? "html" as const : "markdown" as const;
      tabSystem.cacheContent(relativePath, content);
      tabSystem.setTabs((prev) => [...prev, { filePath: relativePath, content, loaded: true, type: fileType }]);
      tabSystem.setActiveTabId(relativePath);
    }, [tabSystem]),
  });

  // Lazy-load root tree when switching to workspace view
  const handleViewChange = useCallback((view: TreeViewMode) => {
    setTreeView(view);
    if (view === "workspace" && rootTree.length === 0) {
      refreshRootTree();
    }
  }, [rootTree, refreshRootTree]);

  const displayTree = treeView === "docs" ? fileTreeData : rootTree;

  // Chat switching
  const chatSwitching = useChatSwitching({
    setActiveTabId: tabSystem.setActiveTabId,
    projectId,
    router,
    onNewChatNavigate: useCallback(() => router.push("/chat/new"), [router]),
  });

  // Initialize chat state from server props
  chatSwitching.init({
    chatId,
    chatTitle,
    initialMessages,
    initialModelId,
    initialTemplateId,
  });

  // --- Bridge callbacks ---

  const handleNavigateToDocument = useCallback(async (documentPath: string) => {
    try {
      const res = await authFetch(`/api/fs/document?path=${projectPath}/${documentPath}`);
      if (res.status === 404) {
        message.warning(t("newChatWorkspace.documentDeleted"));
        return;
      }
      if (!res.ok) return;
    } catch {
      return;
    }
    const node = { name: documentPath.split("/").pop() || documentPath, type: "file" as const, path: documentPath };
    tabSystem.handleFileClick(node);
  }, [projectPath, tabSystem, message, authFetch, t]);

  const handleToolCall = useCallback(({ toolName, args }: { toolName: string; args: Record<string, unknown> }) => {
    if (toolName === "refresh_file_tree") {
      refreshTree();
    } else if (toolName === "refresh_file_content" && args && typeof args.path === "string") {
      tabSystem.refreshFileContent(args.path);
    }
  }, [refreshTree, tabSystem]);

  // --- Shared tab bar helpers ---

  const renderChatTabSuffix = useCallback((targetProjectId?: string) => (
    <span
      role="button"
      onClick={(e) => { e.stopPropagation(); openFloatingChat(targetProjectId); }}
      className="ml-0.5 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-blue-500 transition-opacity"
    >
      {EXTERNAL_LINK_ICON}
    </span>
  ), [openFloatingChat]);

  // --- Render: no project ---

  if (!projectId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center h-[41px] bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 overflow-x-auto shrink-0">
          <TabButton
            active={tabSystem.activeTabId === CHAT_TAB}
            onClick={() => tabSystem.setActiveTabId(CHAT_TAB)}
            icon={CHAT_ICON}
            label={t("tabs.chat")}
            suffix={renderChatTabSuffix()}
          />
        </div>

        <div className="flex-1 min-h-0 relative">
          <div
            className="absolute inset-0"
            style={{ display: tabSystem.activeTabId === CHAT_TAB ? "flex" : "none", flexDirection: "column" }}
          >
            <ChatWorkspace
              key={chatSwitching.chatKey}
              chatId={chatSwitching.activeChatId}
              chatTitle={chatSwitching.activeChatTitle}
              initialMessages={chatSwitching.activeChatMessages}
              initialModelId={chatSwitching.activeChatModelId}
              initialTemplateId={chatSwitching.activeChatTemplateId}
              projectId={projectId}
              projectName={projectName}
              openFileTabs={tabSystem.tabs.map(t => ({
                fileName: t.filePath.split("/").pop() || t.filePath,
                filePath: t.filePath,
              }))}
              onSwitchToChat={chatSwitching.handleSwitchToChat}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Render: has project ---

  return (
    <div className="flex h-full">
      {/* Hidden upload input */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".md,.html,.txt"
        multiple
        className="hidden"
        onChange={handleUploadChange}
      />
      {/* Left Panel - File Tree */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
        <div className="px-3 h-[41px] border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {projectName || projectId} {t("tabs.documents")}
          </h3>
          <button
            onClick={() => refreshTree()}
            disabled={treeLoading}
            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
            title={tc("refresh")}
          >
            <svg className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        <FileTreeToolbar
          onCreateFile={() => handleCreateFile("")}
          onCreateDir={() => handleCreateDir("")}
          onUpload={() => triggerUpload("")}
          disabled={renamingPath !== null}
        />

        {treeLoading ? (
          <div className="flex-1 flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
            <span className="text-xs">{tc("loading")}</span>
          </div>
        ) : (
          <FileTree
            tree={displayTree}
            mode="editable"
            selectedPath={tabSystem.activeTabId !== CHAT_TAB && tabSystem.activeTabId !== PROJECT_INFO_TAB ? tabSystem.activeTabId : null}
            onFileClick={(node) => tabSystem.handleFileClick(node)}
            onNewDirectory={(parentPath) => handleCreateDir(parentPath)}
            onNewFile={(parentPath) => handleCreateFile(parentPath)}
            onDeleteDirectory={(dirPath) => handleDeleteDir(dirPath)}
            onDeleteFile={(filePath) => handleDeleteFile(filePath)}
            onMentionFile={(node) => {
              if (floatingChatOpen && !floatingChatMinimized) {
                setFloatingMentionFile(node.path);
              } else {
                setMentionFile(node.path);
                tabSystem.setActiveTabId(CHAT_TAB);
              }
            }}
            renamingPath={renamingPath}
            renamingName={renamingName}
            onRenamingNameChange={setRenamingName}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={handleRenameCancel}
            renameInputRef={renameInputRef}
            onStartRename={handleStartRename}
            onUpload={(parentPath) => triggerUpload(parentPath)}
          />
        )}

        <FileTreeFooter activeView={treeView} onViewChange={handleViewChange} />
      </div>

      {/* Right Panel - Tab System */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center h-[41px] bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 overflow-x-auto shrink-0">
          <TabButton
            active={tabSystem.activeTabId === PROJECT_INFO_TAB}
            onClick={() => tabSystem.setActiveTabId(PROJECT_INFO_TAB)}
            icon={INFO_ICON}
            label={t("tabs.projectInfo")}
          />

          <TabButton
            active={tabSystem.activeTabId === CHAT_TAB}
            onClick={() => tabSystem.setActiveTabId(CHAT_TAB)}
            icon={CHAT_ICON}
            label={t("tabs.chat")}
            suffix={renderChatTabSuffix(projectId)}
          />

          {tabSystem.tabs.map((tab) => {
            const fileName = tab.filePath.split("/").pop() || tab.filePath;
            return (
              <TabButton
                key={tab.filePath}
                active={tabSystem.activeTabId === tab.filePath}
                onClick={() => tabSystem.setActiveTabId(tab.filePath)}
                icon={FILE_ICON}
                label={fileName}
                suffix={
                  <span
                    role="button"
                    onClick={(e) => tabSystem.handleTabClose(tab.filePath, e)}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    ×
                  </span>
                }
              />
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 relative">
          {/* Project Info */}
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ display: tabSystem.activeTabId === PROJECT_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
          >
            <ProjectInfoTab
              projectId={projectId}
              projectName={projectName || projectId}
              projectMeta={projectMeta ?? null}
              projectPath={`projects/${projectId}`}
              recentChats={recentChats || []}
              recentDocuments={recentDocuments || []}
              onSwitchToChat={chatSwitching.handleSwitchToChat}
              onNewChat={() => router.push("/chat/new")}
              onNavigateToDocument={handleNavigateToDocument}
            />
          </div>

          {/* Chat workspace */}
          <div
            className="absolute inset-0"
            style={{ display: tabSystem.activeTabId === CHAT_TAB ? "flex" : "none", flexDirection: "column" }}
          >
            <ChatWorkspace
              key={chatSwitching.chatKey}
              chatId={chatSwitching.activeChatId}
              chatTitle={chatSwitching.activeChatTitle}
              initialMessages={chatSwitching.activeChatMessages}
              initialModelId={chatSwitching.activeChatModelId}
              initialTemplateId={chatSwitching.activeChatTemplateId}
              embedded
              projectId={projectId}
              projectName={projectName}
              openFileTabs={tabSystem.tabs.map(t => ({
                fileName: t.filePath.split("/").pop() || t.filePath,
                filePath: t.filePath,
              }))}
              onDocumentSaved={refreshTree}
              mentionFile={mentionFile}
              onMentionConsumed={() => setMentionFile(null)}
              onToolCall={handleToolCall}
              onSwitchToChat={chatSwitching.handleSwitchToChat}
            />
          </div>

          {/* File editor tabs */}
          {tabSystem.tabs.map((tab) => (
            <div
              key={tab.filePath}
              className="absolute inset-0"
              style={{ display: tabSystem.activeTabId === tab.filePath ? "flex" : "none", flexDirection: "column" }}
            >
              <EditorTabContent
                filePath={tab.filePath}
                loaded={tab.loaded}
                content={tab.content}
                type={tab.type}
                projectId={projectId!}
                docsPath={projectPath}
                onChange={(markdown) => tabSystem.handleFileChange(tab.filePath, markdown)}
                onSave={() => tabSystem.handleFileSave(tab.filePath, tabSystem.getCachedContent(tab.filePath) ?? tab.content)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
