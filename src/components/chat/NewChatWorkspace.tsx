"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { App } from "antd";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { useFloatingChat } from "./FloatingChatContext";
import { useProjectFileTree } from "./useProjectFileTree";
import { useFileTabSystem, PROJECT_INFO_TAB, CHAT_TAB } from "./useFileTabSystem";
import { useChatSwitching } from "./useChatSwitching";
import type { RecentChat } from "./useChatSwitching";
import FileTree from "@/components/ui/FileTree";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import type { ProjectMeta } from "@/lib/fs";
import type { DocumentActivity } from "@/lib/types";
import type { TreeNode } from "@/lib/tree";
import { stripTreePrefix } from "@/lib/tree";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
      加载编辑器中...
    </div>
  ),
});

export default function NewChatWorkspace() {
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();
  const preselectProjectId = searchParams.get("project");

  // Project selection state
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const { authFetch } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Project info state
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentActivity[]>([]);

  const projectPath = selectedProjectId
    ? `personal/default/projects/${selectedProjectId}/docs`
    : "";

  const autoSelectedRef = useRef(false);

  // --- Custom hooks ---

  const tabSystem = useFileTabSystem({ projectId: selectedProjectId, projectPath });

  const fileTree = useProjectFileTree({
    projectId: selectedProjectId,
    projectPath,
    message,
    onCloseTab: tabSystem.handleTabClose,
    onUpdateTabPaths: tabSystem.updateTabPaths,
  });

  const chatSwitching = useChatSwitching({ setActiveTabId: tabSystem.setActiveTabId });

  // --- Project list fetch ---

  useEffect(() => {
    authFetch("/api/fs/projects?type=personal&accountId=default")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        // Auto-select project from URL param
        if (preselectProjectId && !autoSelectedRef.current) {
          const found = list.find((p: ProjectMeta) => p.id === preselectProjectId);
          if (found) {
            autoSelectedRef.current = true;
            handleSelectProject(found);
          }
        }
      });
  }, []);

  // --- Refresh recent chats & documents ---

  const refreshRecentChats = useCallback(async (projectId: string) => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await authFetch(`/api/chats?projectId=${projectId}&since=${twentyDaysAgo}&pageSize=20`);
      const data = await res.json();
      setRecentChats(data.chats || []);
    } catch {
      setRecentChats([]);
    }
  }, []);

  const refreshRecentDocuments = useCallback(async (projectId: string) => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await authFetch(`/api/document-activities?projectId=${projectId}&since=${twentyDaysAgo}&limit=20`);
      const data = await res.json();
      setRecentDocuments(data.activities || []);
    } catch {
      setRecentDocuments([]);
    }
  }, []);

  // --- Project selection handlers ---

  const handleSelectProject = async (project: ProjectMeta) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.name);
    setProjectMeta(project);

    // Load file tree for the selected project
    fileTree.setTreeLoading(true);
    const prefix = `personal/default/projects/${project.id}/docs`;
    try {
      const res = await authFetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      fileTree.setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      fileTree.setTree([]);
    }
    fileTree.setTreeLoading(false);

    // Reset sub-systems
    tabSystem.reset();
    chatSwitching.reset();

    // Fetch recent chats & documents
    refreshRecentChats(project.id);
    refreshRecentDocuments(project.id);
    window.history.replaceState(null, "", `/chat/new?project=${project.id}`);
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    setSelectedProjectName("");
    setProjectMeta(null);
    setRecentChats([]);
    setRecentDocuments([]);
    fileTree.reset();
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
        alert("该文档已被删除");
        return;
      }
      if (!res.ok) return;
    } catch {
      return;
    }
    const node: TreeNode = { name: documentPath.split("/").pop() || documentPath, type: "file", path: documentPath };
    tabSystem.handleFileClick(node);
  }, [projectPath, tabSystem.handleFileClick]);



  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
        {selectedProjectId ? (
          <>
            {/* Selected project header */}
            <div className="px-3 h-[41px] border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center gap-2">
              <button
                onClick={handleBack}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="返回项目列表"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{selectedProjectName} Documents</h3>
            </div>

            {/* File tree toolbar */}
            <div className="px-2 py-1.5 border-b border-gray-100 dark:border-zinc-700 flex gap-1">
              <button
                onClick={() => fileTree.handleCreateFile("")}
                disabled={fileTree.renamingPath !== null}
                className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                Document
              </button>
              <button
                onClick={() => fileTree.handleCreateDir("")}
                disabled={fileTree.renamingPath !== null}
                className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                Folder
              </button>
            </div>

            {/* File tree */}
            {fileTree.treeLoading ? (
              <div className="flex-1 flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : (
              <FileTree
                tree={fileTree.tree}
                mode="editable"
                selectedPath={tabSystem.activeTabId !== CHAT_TAB && tabSystem.activeTabId !== PROJECT_INFO_TAB ? tabSystem.activeTabId : null}
                onFileClick={(node) => tabSystem.handleFileClick(node)}
                onNewDirectory={(parentPath) => fileTree.handleCreateDir(parentPath)}
                onNewFile={(parentPath) => fileTree.handleCreateFile(parentPath)}
                onDeleteDirectory={(dirPath) => fileTree.handleDeleteDir(dirPath)}
                onDeleteFile={(filePath) => fileTree.handleDeleteFile(filePath)}
                onMentionFile={(node) => {
                  if (floatingChatOpen && !floatingChatMinimized) {
                    setFloatingMentionFile(node.path);
                  } else {
                    setMentionFile(node.path);
                    tabSystem.setActiveTabId(CHAT_TAB);
                  }
                }}
                renamingPath={fileTree.renamingPath}
                renamingName={fileTree.renamingName}
                onRenamingNameChange={fileTree.setRenamingName}
                onRenameConfirm={fileTree.handleRenameConfirm}
                onRenameCancel={fileTree.handleRenameCancel}
                renameInputRef={fileTree.renameInputRef}
                onStartRename={fileTree.handleStartRename}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col m-2 animate-blue-breathing overflow-hidden bg-white dark:bg-zinc-800">
            {/* Project selection header */}
            <div className="px-3 h-[41px] border-b border-gray-200 dark:border-zinc-700 flex items-center">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Select Project</h3>
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto py-1">
              {projects.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">暂无项目，请先在侧边栏创建</p>
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
                Project Info
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
                Chat
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
                        ? "bg-white text-blue-600 border-blue-600"
                        : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
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
                  projectPath={`personal/default/projects/${selectedProjectId}`}
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
                  onDocumentSaved={fileTree.refreshTree}
                  mentionFile={mentionFile}
                  onMentionConsumed={() => setMentionFile(null)}
                  onToolCall={({ toolName }) => { if (toolName === "refresh_file_tree") fileTree.refreshTree(); }}
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
                      onSave={() => tabSystem.handleFileSave(tab.filePath, tabSystem.contentCache.current[tab.filePath] ?? tab.content)}
                      defaultModel="editOnly"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-zinc-900">
            <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-xl p-8 border-l-4 border-blue-400 dark:border-blue-600 max-w-sm mx-4 shadow-sm">
              {/* 指向左侧的弹跳箭头 */}
              <div className="flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-slide-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              {/* 主图标 */}
              <svg className="w-16 h-16 mx-auto mb-4 text-blue-400 dark:text-blue-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {/* 提示文字 */}
              <p className="text-lg text-blue-700 dark:text-blue-300 font-medium">Please select a project on the left first</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
