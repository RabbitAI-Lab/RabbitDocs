"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { App } from "antd";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { useFloatingChat } from "./FloatingChatContext";
import { useProjectFileTree } from "./useProjectFileTree";
import { useFileTabSystem, PROJECT_INFO_TAB, CHAT_TAB } from "./useFileTabSystem";
import { useChatSwitching } from "./useChatSwitching";
import type { RecentChat } from "./useChatSwitching";
import FileTree from "@/components/ui/FileTree";
import FileTreeFooter, { type TreeViewMode } from "@/components/ui/FileTreeFooter";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import type { ProjectMeta } from "@/lib/fs";
import type { DocumentActivity } from "@/lib/types";
import type { TreeNode } from "@/lib/tree";
import { stripTreePrefix } from "@/lib/tree";

function EditorLoadingSpinner() {
  const tc = useTranslations("common");
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
      {tc("loadingEditor")}
    </div>
  );
}

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => <EditorLoadingSpinner />,
});

export default function NewChatWorkspace() {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();
  const preselectProjectId = searchParams.get("project");

  // Project selection state
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const { authFetch, user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [mentionFile, setMentionFile] = useState<string | null>(null);
  const [treeView, setTreeView] = useState<TreeViewMode>("docs");

  // Project info state
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentActivity[]>([]);

  const projectPath = selectedProjectId
    ? `projects/${selectedProjectId}/docs`
    : "";

  const autoSelectedRef = useRef(false);

  // --- Custom hooks ---

  const tabSystem = useFileTabSystem({ projectId: selectedProjectId, projectPath });

  const {
    tree: fileTreeData,
    setTree,
    rootTree,
    treeLoading,
    setTreeLoading,
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
    reset: resetFileTree,
  } = useProjectFileTree({
    projectId: selectedProjectId,
    projectPath,
    message,
    onCloseTab: tabSystem.handleTabClose,
    onUpdateTabPaths: tabSystem.updateTabPaths,
  });

  const chatSwitching = useChatSwitching({ setActiveTabId: tabSystem.setActiveTabId });

  // Lazy-load root tree when switching to workspace view
  const handleViewChange = useCallback((view: TreeViewMode) => {
    setTreeView(view);
    if (view === "workspace" && rootTree.length === 0) {
      refreshRootTree();
    }
  }, [rootTree, refreshRootTree]);

  const displayTree = treeView === "docs" ? fileTreeData : rootTree;

  // --- Refresh recent chats & documents ---

  const refreshRecentChats = useCallback(async (projectId: string) => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await authFetch(`/api/chats?projectId=${projectId}&since=${twentyDaysAgo}&pageSize=20&scope=all`);
      const data = await res.json();
      setRecentChats(data.chats || []);
    } catch {
      setRecentChats([]);
    }
  }, [authFetch]);

  const refreshRecentDocuments = useCallback(async (projectId: string) => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await authFetch(`/api/document-activities?projectId=${projectId}&since=${twentyDaysAgo}&limit=20`);
      const data = await res.json();
      setRecentDocuments(data.activities || []);
    } catch {
      setRecentDocuments([]);
    }
  }, [authFetch]);

  // --- Project selection handlers ---

  const handleSelectProjectRef = useRef<(project: ProjectMeta) => Promise<void>>((_) => Promise.resolve());

  const handleSelectProject = useCallback(async (project: ProjectMeta) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.name);
    setProjectMeta(project);

    // Load file tree for the selected project
    setTreeLoading(true);
    const prefix = `projects/${project.id}/docs`;
    try {
      const res = await authFetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);

    // Reset sub-systems
    tabSystem.reset();
    chatSwitching.reset();

    // Fetch recent chats & documents
    refreshRecentChats(project.id);
    refreshRecentDocuments(project.id);
    router.push(`/project/${project.id}`);
  }, [authFetch, setTreeLoading, setTree, tabSystem, chatSwitching, refreshRecentChats, refreshRecentDocuments, router]);

  // Keep ref in sync with latest handleSelectProject on every render
  useEffect(() => {
    handleSelectProjectRef.current = handleSelectProject;
  });

  // --- Project list fetch ---

  useEffect(() => {
    authFetch(`/api/fs/projects?type=personal&accountId=${user?.id ?? ''}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        // Auto-select project from URL param
        if (preselectProjectId && !autoSelectedRef.current) {
          const found = list.find((p: ProjectMeta) => p.id === preselectProjectId);
          if (found) {
            autoSelectedRef.current = true;
            handleSelectProjectRef.current(found);
          }
        }
      });
  }, [authFetch, user?.id, preselectProjectId]);

  const handleBack = () => {
    setSelectedProjectId(null);
    setSelectedProjectName("");
    setProjectMeta(null);
    setRecentChats([]);
    setRecentDocuments([]);
    resetFileTree();
    tabSystem.reset();
    chatSwitching.reset();
    window.history.replaceState(null, "", "/chat/new");
  };

  // --- Callbacks ---

  const handleChatCreated = useCallback((_chatId: number) => {
    if (selectedProjectId) {
      refreshRecentChats(selectedProjectId);
    }
  }, [selectedProjectId, refreshRecentChats]);

  const handleNavigateToDocument = useCallback(async (documentPath: string) => {
    try {
      const res = await authFetch(`/api/fs/document?path=${projectPath}/${documentPath}`);
      if (res.status === 404) {
        alert(t("newChatWorkspace.documentDeleted"));
        return;
      }
      if (!res.ok) return;
    } catch {
      return;
    }
    const node: TreeNode = { name: documentPath.split("/").pop() || documentPath, type: "file", path: documentPath };
    tabSystem.handleFileClick(node);
  }, [authFetch, t, projectPath, tabSystem]);



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
      {/* Left Panel */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
        {selectedProjectId ? (
          <>
            {/* Selected project header */}
            <div className="px-3 h-[41px] border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleBack}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                  title={t("newChatWorkspace.backToProjectList")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{selectedProjectName} {t("tabs.documents")}</h3>
              </div>
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

            {/* File tree toolbar */}
            <div className="px-2 py-1.5 border-b border-gray-100 dark:border-zinc-700 flex gap-0.5 justify-center">
              <button
                onClick={() => handleCreateFile("")}
                disabled={renamingPath !== null}
                className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                {t('document')}
              </button>
              <button
                onClick={() => handleCreateDir("")}
                disabled={renamingPath !== null}
                className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                {t('folder')}
              </button>
              <button
                onClick={() => triggerUpload("")}
                disabled={renamingPath !== null}
                className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t('upload')}
              </button>
            </div>

            {/* File tree */}
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
          </>
        ) : (
          <div className="flex-1 flex flex-col m-2 animate-blue-breathing overflow-hidden bg-white dark:bg-zinc-800">
            {/* Project selection header */}
            <div className="px-3 h-[41px] border-b border-gray-200 dark:border-zinc-700 flex items-center">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("newChatWorkspace.selectProject")}</h3>
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto py-1">
              {projects.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">{t("newChatWorkspace.noProjects")}</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-left"
                  >
                    <svg className="w-4 h-4 shrink-0 text-blue-400 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {selectedProjectId ? (
          <>
            {/* Tab Bar */}
            <div className="flex items-center h-[41px] bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 overflow-x-auto shrink-0">
              {/* Project Info tab */}
              <button
                onClick={() => tabSystem.setActiveTabId(PROJECT_INFO_TAB)}
                className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tabSystem.activeTabId === PROJECT_INFO_TAB
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                {t("tabs.projectInfo")}
              </button>

              {/* Chat tab */}
              <button
                onClick={() => tabSystem.setActiveTabId(CHAT_TAB)}
                className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tabSystem.activeTabId === CHAT_TAB
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {t("tabs.chat")}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); openFloatingChat(selectedProjectId ?? undefined); }}
                  className="ml-0.5 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-blue-500 transition-opacity"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <path d="M21 3l-7 7" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                </span>
              </button>

              {/* File tabs */}
              {tabSystem.tabs.map((tab) => {
                const fileName = tab.filePath.split("/").pop() || tab.filePath;
                return (
                  <button
                    key={tab.filePath}
                    onClick={() => tabSystem.setActiveTabId(tab.filePath)}
                    className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                      tabSystem.activeTabId === tab.filePath
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate max-w-[120px]">{fileName}</span>
                    <span
                      role="button"
                      onClick={(e) => tabSystem.handleTabClose(tab.filePath, e)}
                      className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      ×
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 relative">
              {/* Project Info tab content */}
              <div
                className="absolute inset-0 overflow-y-auto"
                style={{ display: tabSystem.activeTabId === PROJECT_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
              >
                <ProjectInfoTab
                  projectId={selectedProjectId}
                  projectName={selectedProjectName}
                  projectMeta={projectMeta}
                  projectPath={`projects/${selectedProjectId}`}
                  recentChats={recentChats}
                  recentDocuments={recentDocuments}
                  onSwitchToChat={chatSwitching.handleSwitchToChat}
                  onNewChat={chatSwitching.handleNewChat}
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
                  projectId={selectedProjectId}
                  projectName={selectedProjectName}
                  openFileTabs={tabSystem.tabs.map(t => ({
                    fileName: t.filePath.split("/").pop() || t.filePath,
                    filePath: t.filePath,
                  }))}
                  onDocumentSaved={refreshTree}
                  mentionFile={mentionFile}
                  onMentionConsumed={() => setMentionFile(null)}
                  onToolCall={({ toolName, args }) => {
                    if (toolName === "refresh_file_tree") refreshTree();
                    else if (toolName === "refresh_file_content" && args && typeof args.path === "string") tabSystem.refreshFileContent(args.path);
                  }}
                  onChatCreated={handleChatCreated}
                />
              </div>

              {/* File editor tabs */}
              {tabSystem.tabs.map((tab) => (
                <div
                  key={tab.filePath}
                  className="absolute inset-0"
                  style={{ display: tabSystem.activeTabId === tab.filePath ? "flex" : "none", flexDirection: "column" }}
                >
                  {tab.loaded ? (
                    <CherryEditor
                      key={tab.filePath}
                      editorId={"cherry-" + tab.filePath.replace(/\//g, "-")}
                      initialValue={tab.content}
                      onChange={(markdown) => tabSystem.handleFileChange(tab.filePath, markdown)}
                      onSave={() => tabSystem.handleFileSave(tab.filePath, tabSystem.getCachedContent(tab.filePath) ?? tab.content)}
                      defaultModel="editOnly"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
                      <span className="text-sm">{tc("loading")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
            <div className="text-center max-w-[280px] mx-4 animate-glow-soft rounded-2xl px-8 py-10 bg-gradient-to-b from-blue-50/70 to-white/60 dark:from-blue-950/25 dark:to-zinc-800/30">
              {/* 浮动聊天气泡图标 */}
              <div className="animate-float-gentle mb-5">
                <svg className="w-12 h-12 mx-auto text-blue-300 dark:text-blue-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              {/* 提示文字 */}
              <p className="text-[15px] leading-relaxed text-blue-500/80 dark:text-blue-300/70 font-medium">
                {t("newChatWorkspace.pleaseSelectProject")}
              </p>
              {/* 方向引导箭头 */}
              <div className="mt-4 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-400/50 dark:text-blue-500/40 animate-arrow-glide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
