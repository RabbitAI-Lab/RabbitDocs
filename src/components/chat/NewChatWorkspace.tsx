"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import FileTree from "@/components/ui/FileTree";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import type { ProjectMeta } from "@/lib/fs";
import { TreeNode, stripTreePrefix } from "@/lib/tree";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-2" />
      加载编辑器中...
    </div>
  ),
});

interface FileTab {
  filePath: string;
  content: string;
  loaded: boolean;
}

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
}

const PROJECT_INFO_TAB = "__project_info__" as const;

/** Compute the default directory name, handling conflicts */
function computeDefaultDirName(existingChildren: TreeNode[]): string {
  const baseName = "新建文件夹";
  const existingNames = new Set(
    existingChildren.filter((n) => n.type === "directory").map((n) => n.name),
  );
  if (!existingNames.has(baseName)) return baseName;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})`)) i++;
  return `${baseName}(${i})`;
}

/** Find children nodes for a given parent path */
function findChildren(nodes: TreeNode[], parentPath: string): TreeNode[] {
  for (const node of nodes) {
    if (node.path === parentPath && node.children) return node.children;
    if (node.children) {
      const found = findChildren(node.children, parentPath);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export default function NewChatWorkspace() {
  const searchParams = useSearchParams();
  const preselectProjectId = searchParams.get("project");
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [newDirParent, setNewDirParent] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParent, setNewFileParent] = useState("");
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Project info state
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);

  // Chat switching state
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("新对话");
  const [activeChatMessages, setActiveChatMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string }>>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();

  // Tab system state
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("__chat__");
  const contentCache = useRef<Record<string, string>>({});

  const projectPath = selectedProjectId
    ? `personal/default/projects/${selectedProjectId}/docs`
    : "";

  const autoSelectedRef = useRef(false);

  useEffect(() => {
    fetch("/api/fs/projects?type=personal&accountId=default")
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

  const refreshTree = async () => {
    if (!selectedProjectId) return;
    setTreeLoading(true);
    const prefix = `personal/default/projects/${selectedProjectId}/docs`;
    try {
      const res = await fetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);
  };

  const handleSelectProject = async (project: ProjectMeta) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.name);
    setProjectMeta(project);
    setTreeLoading(true);
    const prefix = `personal/default/projects/${project.id}/docs`;
    try {
      const res = await fetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);
    setChatKey((k) => k + 1);
    // Reset tab system — default to chat tab since this is the "New Chat" entry
    setTabs([]);
    setActiveTabId("__chat__");
    contentCache.current = {};
    // Reset chat switching state
    setActiveChatId(null);
    setActiveChatTitle("新对话");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    // Fetch recent chats
    refreshRecentChats(project.id);
    window.history.replaceState(null, "", `/chat/new?project=${project.id}`);
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    setSelectedProjectName("");
    setProjectMeta(null);
    setRecentChats([]);
    setTree([]);
    setShowNewDir(false);
    setNewDirName("");
    setNewDirParent("");
    // Reset tab system
    setTabs([]);
    setActiveTabId("__chat__");
    contentCache.current = {};
    // Reset chat switching state
    setActiveChatId(null);
    setActiveChatTitle("新对话");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    window.history.replaceState(null, "", "/chat/new");
  };

  const handleStartNewDir = useCallback((parentPath: string) => {
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultDirName(children);
    setNewDirParent(parentPath);
    setNewDirName(defaultName);
    setShowNewDir(true);
    setTimeout(() => dirInputRef.current?.select(), 0);
  }, [tree]);

  const handleCreateDir = async () => {
    if (!newDirName.trim() || !selectedProjectId) return;
    const fullPath = newDirParent
      ? `${projectPath}/${newDirParent}/${newDirName.trim()}`
      : `${projectPath}/${newDirName.trim()}`;
    await fetch("/api/fs/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    setShowNewDir(false);
    setNewDirName("");
    setNewDirParent("");
    refreshTree();
  };

  const handleCancelNewDir = () => {
    setShowNewDir(false);
    setNewDirName("");
    setNewDirParent("");
  };

  const handleDeleteDir = async (dirPath: string) => {
    const name = dirPath.split("/").pop() || dirPath;
    if (!confirm(`确认删除文件夹 "${name}" 及其所有内容?`)) return;
    await fetch("/api/fs/directory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${dirPath}` }),
    });
    refreshTree();
  };

  const handleDeleteFile = async (filePath: string) => {
    const name = filePath.split("/").pop() || filePath;
    if (!confirm(`确认删除文档 "${name}"?`)) return;
    await fetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${filePath}` }),
    });
    // Close the tab if open
    if (tabs.some((t) => t.filePath === filePath)) {
      handleTabClose(filePath);
    }
    refreshTree();
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !selectedProjectId) return;
    const fullPath = newFileParent
      ? `${projectPath}/${newFileParent}/${newFileName.trim()}`
      : `${projectPath}/${newFileName.trim()}`;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath, content: `# ${newFileName.trim()}\n\n` }),
    });
    setShowNewFile(false);
    setNewFileName("");
    setNewFileParent("");
    refreshTree();
  };

  // --- Tab system functions ---

  const handleFileClick = useCallback(async (node: TreeNode) => {
    const filePath = node.path;
    // If tab already open, switch to it
    setTabs((prev) => {
      const existingTab = prev.find((t) => t.filePath === filePath);
      if (existingTab) {
        setActiveTabId(filePath);
        return prev;
      }
      // Create new tab
      const cachedContent = contentCache.current[filePath] ?? "";
      const newTab: FileTab = {
        filePath,
        content: cachedContent,
        loaded: !!cachedContent,
      };
      setActiveTabId(filePath);

      // Fetch content if not cached
      if (!cachedContent) {
        const apiPath = `personal/default/projects/${selectedProjectId}/docs/${filePath}`;
        fetch(`/api/fs/document?path=${apiPath}`)
          .then((r) => r.json())
          .then((data) => {
            const content = data.content ?? "";
            contentCache.current[filePath] = content;
            setTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content, loaded: true } : t
              )
            );
          })
          .catch(() => {
            setTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content: "", loaded: true } : t
              )
            );
          });
      }

      return [...prev, newTab];
    });
  }, [selectedProjectId]);

  const handleTabClose = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.filePath === tabId);
      const newTabs = prev.filter((t) => t.filePath !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length === 0) {
          setActiveTabId(PROJECT_INFO_TAB);
        } else if (idx < newTabs.length) {
          setActiveTabId(newTabs[idx].filePath);
        } else {
          setActiveTabId(newTabs[newTabs.length - 1].filePath);
        }
      }
      return newTabs;
    });
  }, [activeTabId]);

  const handleFileSave = useCallback(async (filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${filePath}`, content: markdown }),
    });
  }, [projectPath]);

  const handleFileChange = useCallback((filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
  }, []);

  // --- Chat navigation from ProjectInfoTab ---

  const handleSwitchToChat = useCallback(async (chatId: number) => {
    try {
      const [chatRes, msgRes] = await Promise.all([
        fetch(`/api/chats/${chatId}`),
        fetch(`/api/chats/${chatId}/messages`),
      ]);
      const chatData = await chatRes.json();
      const msgData = await msgRes.json();

      setActiveChatId(chatId);
      setActiveChatTitle(chatData.title || "新对话");
      setActiveChatMessages(
        (msgData.messages || []).map((m: { id: number; role: "user" | "assistant"; content: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
      setActiveChatModelId(chatData.modelId);
      setActiveChatTemplateId(chatData.templateId);
      setChatKey((k) => k + 1);
      setActiveTabId("__chat__");
    } catch {
      setActiveTabId("__chat__");
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveChatTitle("新对话");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setChatKey((k) => k + 1);
    setActiveTabId("__chat__");
  }, []);

  // --- Refresh recent chats ---

  const refreshRecentChats = useCallback(async (projectId: string) => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res = await fetch(`/api/chats?projectId=${projectId}&since=${twentyDaysAgo}&pageSize=20`);
      const data = await res.json();
      setRecentChats(data.chats || []);
    } catch {
      setRecentChats([]);
    }
  }, []);

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 bg-gray-50 shrink-0">
        {selectedProjectId ? (
          <>
            {/* Selected project header */}
            <div className="px-3 h-[41px] border-b border-gray-200 bg-white flex items-center gap-2">
              <button
                onClick={handleBack}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                title="返回项目列表"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-gray-800 truncate">{selectedProjectName} 文档</h3>
            </div>

            {/* File tree toolbar */}
            <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1">
              <button
                onClick={() => {
                  setNewFileName("");
                  setNewFileParent("");
                  setShowNewFile(true);
                }}
                className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                新建文档
              </button>
              <button
                onClick={() => handleStartNewDir("")}
                className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                新建文件夹
              </button>
            </div>

            {/* New file input */}
            {showNewFile && (
              <div className="px-2 py-1.5 border-b border-gray-100 bg-blue-50">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
                  placeholder={newFileParent ? `${newFileParent}/文档名` : "文档名"}
                  className="w-full px-2 py-1 text-xs border border-blue-200 rounded focus:outline-none focus:border-blue-400"
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={handleCreateFile}
                    className="px-2 py-0.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    创建
                  </button>
                  <button
                    onClick={() => { setShowNewFile(false); setNewFileName(""); setNewFileParent(""); }}
                    className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* File tree */}
            {treeLoading ? (
              <div className="flex-1 flex items-center justify-center py-8 text-gray-400">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : (
              <FileTree
                tree={tree}
                mode="editable"
                selectedPath={activeTabId !== "__chat__" && activeTabId !== PROJECT_INFO_TAB ? activeTabId : null}
                onFileClick={(node) => handleFileClick(node)}
                onNewDirectory={(parentPath) => handleStartNewDir(parentPath)}
                onNewFile={(parentPath) => { setNewFileParent(parentPath); setShowNewFile(true); }}
                onDeleteDirectory={(dirPath) => handleDeleteDir(dirPath)}
                onDeleteFile={(filePath) => handleDeleteFile(filePath)}
                onMentionFile={(node) => {
                  setMentionFile(node.path);
                  setActiveTabId("__chat__");
                }}
                creatingDirParent={showNewDir ? newDirParent : null}
                creatingDirName={newDirName}
                onCreatingDirNameChange={setNewDirName}
                onCreatingDirConfirm={handleCreateDir}
                onCreatingDirCancel={handleCancelNewDir}
                dirInputRef={dirInputRef}
              />
            )}
          </>
        ) : (
          <>
            {/* Project selection header */}
            <div className="px-3 h-[41px] border-b border-gray-200 bg-white flex items-center">
              <h3 className="text-sm font-semibold text-gray-800">选择项目</h3>
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto py-1">
              {projects.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">暂无项目，请先在侧边栏创建</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-left"
                  >
                    <svg className="w-4 h-4 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Panel */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {selectedProjectId ? (
          <>
            {/* Tab Bar */}
            <div className="flex items-center h-[41px] bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
              {/* Project Info tab */}
              <button
                onClick={() => setActiveTabId(PROJECT_INFO_TAB)}
                className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTabId === PROJECT_INFO_TAB
                    ? "bg-white text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                项目信息
              </button>

              {/* Chat tab */}
              <button
                onClick={() => setActiveTabId("__chat__")}
                className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTabId === "__chat__"
                    ? "bg-white text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                对话
              </button>

              {/* File tabs */}
              {tabs.map((tab) => {
                const fileName = tab.filePath.split("/").pop() || tab.filePath;
                return (
                  <button
                    key={tab.filePath}
                    onClick={() => setActiveTabId(tab.filePath)}
                    className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTabId === tab.filePath
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
                      onClick={(e) => handleTabClose(tab.filePath, e)}
                      className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                style={{ display: activeTabId === PROJECT_INFO_TAB ? "flex" : "none", flexDirection: "column" }}
              >
                <ProjectInfoTab
                  projectId={selectedProjectId}
                  projectName={selectedProjectName}
                  projectMeta={projectMeta}
                  projectPath={`personal/default/projects/${selectedProjectId}`}
                  recentChats={recentChats}
                  onSwitchToChat={handleSwitchToChat}
                  onNewChat={handleNewChat}
                />
              </div>

              {/* Chat workspace */}
              <div
                className="absolute inset-0"
                style={{ display: activeTabId === "__chat__" ? "flex" : "none", flexDirection: "column" }}
              >
                <ChatWorkspace
                  key={chatKey}
                  chatId={activeChatId}
                  chatTitle={activeChatTitle}
                  initialMessages={activeChatMessages}
                  initialModelId={activeChatModelId}
                  initialTemplateId={activeChatTemplateId}
                  embedded
                  projectId={selectedProjectId}
                  onDocumentSaved={refreshTree}
                  mentionFile={mentionFile}
                  onMentionConsumed={() => setMentionFile(null)}
                  onToolCall={({ toolName }) => { if (toolName === "refresh_file_tree") refreshTree(); }}
                />
              </div>

              {/* File editor tabs */}
              {tabs.map((tab) => (
                <div
                  key={tab.filePath}
                  className="absolute inset-0"
                  style={{ display: activeTabId === tab.filePath ? "flex" : "none", flexDirection: "column" }}
                >
                  {tab.loaded ? (
                    <CherryEditor
                      key={tab.filePath}
                      editorId={"cherry-" + tab.filePath.replace(/\//g, "-")}
                      initialValue={tab.content}
                      onChange={(markdown) => handleFileChange(tab.filePath, markdown)}
                      onSave={() => handleFileSave(tab.filePath, contentCache.current[tab.filePath] ?? tab.content)}
                      defaultModel="editOnly"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-100">
            <div className="text-center bg-purple-50 rounded-xl p-8 border-l-4 border-purple-400 max-w-sm mx-4 shadow-sm">
              {/* 指向左侧的弹跳箭头 */}
              <div className="flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-500 animate-slide-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              {/* 主图标 */}
              <svg className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {/* 提示文字 */}
              <p className="text-lg text-gray-700 font-medium">请先在左侧选择一个项目</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
