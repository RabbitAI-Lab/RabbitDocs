"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { App } from "antd";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { useFloatingChat } from "@/components/chat/FloatingChatContext";
import FileTree from "@/components/ui/FileTree";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import type { Repository } from "@/lib/fs";
import type { DocumentActivity } from "@/lib/types";
import { TreeNode, computeDefaultDirName, computeDefaultFileName, findChildren, findNodeByPath, renameNodeInTree } from "@/lib/tree";

const PROJECT_INFO_TAB = "__project_info__" as const;

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-2" />
      加载编辑器中...
    </div>
  ),
});

const HtmlEditor = dynamic(() => import("@/components/editor/HtmlEditor"), {
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
  type: "markdown" | "html";
}

interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;
  repositories?: Repository[];
}

interface AccountInfo {
  accountName: string;
  orgName?: string;
  enterpriseName?: string;
}

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
}

interface ProjectWorkspaceProps {
  projectName: string;
  projectPath: string; // e.g. "personal/default/projects/{projectId}"
  docsPath: string; // e.g. "personal/default/projects/{projectId}/docs"
  tree: TreeNode[];
  selectedFile: string | null; // relative path within project, from ?file= URL param
  initialContent: string; // file content preloaded by server
  projectMeta: ProjectMeta | null;
  accountInfo: AccountInfo;
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
}

export default function ProjectWorkspace({
  projectName,
  projectPath,
  docsPath,
  tree: initialTree,
  selectedFile,
  initialContent,
  projectMeta,
  recentChats,
  recentDocuments,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();
  // Chat state
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("New Chat");
  const [activeChatMessages, setActiveChatMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string }>>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();

  // File tree controls
  const [tree, setTree] = useState<TreeNode[]>(initialTree);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Sync tree when server props change (after router.refresh())
  useEffect(() => {
    if (renamingPath === null) {
      setTree(initialTree);
    }
  }, [initialTree, renamingPath]);

  // Tab system state — initialize from URL ?file= param
  const initTab = selectedFile && initialContent !== undefined
    ? [{
        filePath: selectedFile,
        content: initialContent,
        loaded: true,
        type: (selectedFile.toLowerCase().endsWith(".html") ? "html" : "markdown") as "markdown" | "html",
      }]
    : [];
  const [tabs, setTabs] = useState<FileTab[]>(initTab);
  const [activeTabId, setActiveTabId] = useState<string>(PROJECT_INFO_TAB);
  const contentCache = useRef<Record<string, string>>(
    selectedFile && initialContent !== undefined ? { [selectedFile]: initialContent } : {}
  );

  const projectId = projectPath.split("/")[3] || "";

  // --- File tree functions ---

  const handleCreateFile = useCallback(async (parentPath: string) => {
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultFileName(children);
    const fullPath = parentPath
      ? `${docsPath}/${parentPath}/${defaultName}`
      : `${docsPath}/${defaultName}`;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath, content: `# ${defaultName}\n\n` }),
    });
    const relativePath = parentPath ? `${parentPath}/${defaultName}` : defaultName;
    // Optimistically insert node into local tree
    const newNode: TreeNode = { name: defaultName, type: "file", path: relativePath };
    setTree((prev) => {
      if (!parentPath) return [...prev, newNode];
      return insertNode(prev, parentPath, newNode);
    });
    setRenamingPath(relativePath);
    setRenamingName(defaultName);
    setTimeout(() => renameInputRef.current?.select(), 0);
    // Open the new file as a tab
    const fileContent = `# ${defaultName}\n\n`;
    contentCache.current[relativePath] = fileContent;
    setTabs((prev) => [...prev, { filePath: relativePath, content: fileContent, loaded: true, type: "markdown" }]);
    setActiveTabId(relativePath);
    router.refresh();
  }, [tree, docsPath, router]);

  const handleCreateDir = useCallback(async (parentPath: string) => {
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultDirName(children);
    const fullPath = parentPath
      ? `${docsPath}/${parentPath}/${defaultName}`
      : `${docsPath}/${defaultName}`;
    await fetch("/api/fs/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    const relativePath = parentPath ? `${parentPath}/${defaultName}` : defaultName;
    // Optimistically insert node into local tree
    const newNode: TreeNode = { name: defaultName, type: "directory", path: relativePath, children: [] };
    setTree((prev) => {
      if (!parentPath) return [...prev, newNode];
      return insertNode(prev, parentPath, newNode);
    });
    setRenamingPath(relativePath);
    setRenamingName(defaultName);
    setTimeout(() => renameInputRef.current?.select(), 0);
    router.refresh();
  }, [tree, docsPath, router]);

  const handleRenameConfirm = useCallback(async () => {
    const currentPath = renamingPath;
    const currentName = renamingName;
    if (!currentPath) return;

    const trimmedName = currentName.trim();
    const node = findNodeByPath(tree, currentPath);
    if (!node || !trimmedName || trimmedName === node.name) {
      setRenamingPath(null);
      return;
    }

    let res: Response;
    if (node.type === "file") {
      res = await fetch("/api/fs/document", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${docsPath}/${currentPath}`, newTitle: trimmedName }),
      });
    } else {
      res = await fetch("/api/fs/directory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${docsPath}/${currentPath}`, newName: trimmedName }),
      });
    }

    if (res.status === 409) {
      const data = await res.json();
      message.warning(data.error || "A file or folder with this name already exists");
      // Keep the input focused so user can change the name
      setTimeout(() => renameInputRef.current?.focus(), 0);
      return;
    }

    // Update tab paths for file renames
    if (node.type === "file") {
      const newPath = currentPath.includes("/")
        ? currentPath.replace(/[^/]*$/, trimmedName)
        : trimmedName;
      updateTabPaths(currentPath, newPath);
    }

    // Optimistically update the local tree so the new name is visible immediately
    setTree((prev) => renameNodeInTree(prev, currentPath, trimmedName));
    setRenamingPath(null);
    router.refresh();
  }, [renamingPath, renamingName, tree, docsPath, router]);

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const handleStartRename = useCallback((path: string) => {
    const node = findNodeByPath(tree, path);
    if (!node) return;
    setRenamingPath(path);
    setRenamingName(node.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, [tree]);

  const handleDeleteDir = async (dirPath: string) => {
    await fetch("/api/fs/directory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${dirPath}` }),
    });
    router.refresh();
  };

  const handleDeleteFile = async (filePath: string) => {
    await fetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${filePath}` }),
    });
    // Close the tab if open
    if (tabs.some((t) => t.filePath === filePath)) {
      handleTabClose(filePath);
    }
    router.refresh();
  };

  // Helper to update tab paths when a file is renamed
  const updateTabPaths = (oldPath: string, newPath: string) => {
    setTabs((prev) => prev.map((t) => t.filePath === oldPath ? { ...t, filePath: newPath } : t));
    setActiveTabId((prev) => prev === oldPath ? newPath : prev);
    const cached = contentCache.current[oldPath];
    if (cached !== undefined) {
      contentCache.current[newPath] = cached;
      delete contentCache.current[oldPath];
    }
  };

  // --- Tab system functions ---

  const handleFileClick = useCallback((node: TreeNode) => {
    const filePath = node.path;
    setTabs((prev) => {
      const existingTab = prev.find((t) => t.filePath === filePath);
      if (existingTab) {
        setActiveTabId(filePath);
        return prev;
      }
      // Create new tab
      const cachedContent = contentCache.current[filePath] ?? "";
      const tabType: "markdown" | "html" = filePath.toLowerCase().endsWith(".html")
        ? "html"
        : "markdown";
      const newTab: FileTab = {
        filePath,
        content: cachedContent,
        loaded: !!cachedContent,
        type: tabType,
      };
      setActiveTabId(filePath);

      // Fetch content if not cached
      if (!cachedContent) {
        fetch(`/api/fs/document?path=${docsPath}/${filePath}`)
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
  }, [docsPath]);

  // Open (or switch to) an HTML file in a tab. Triggered by preview_html client tool.
  const handlePreviewHtml = useCallback(async (filePath: string) => {
    if (!filePath || !filePath.toLowerCase().endsWith(".html")) {
      message.warning("preview_html 仅支持 .html 文件");
      return;
    }
    setTabs((prev) => {
      const existing = prev.find((t) => t.filePath === filePath);
      if (existing) {
        setActiveTabId(filePath);
        return prev;
      }
      const cached = contentCache.current[filePath];
      if (cached !== undefined) {
        setActiveTabId(filePath);
        return [...prev, { filePath, content: cached, loaded: true, type: "html" }];
      }
      // Otherwise create a loading tab and fetch content asynchronously.
      setActiveTabId(filePath);
      fetch(`/api/fs/document?path=${docsPath}/${filePath}`)
        .then((r) => {
          if (!r.ok) throw new Error("fetch failed");
          return r.json();
        })
        .then((data) => {
          const content = data.content ?? "";
          contentCache.current[filePath] = content;
          setTabs((prev2) => {
            if (prev2.some((t) => t.filePath === filePath)) {
              return prev2.map((t) =>
                t.filePath === filePath ? { ...t, content, loaded: true } : t
              );
            }
            return [...prev2, { filePath, content, loaded: true, type: "html" }];
          });
        })
        .catch(() => {
          setTabs((prev2) => {
            if (prev2.some((t) => t.filePath === filePath)) {
              return prev2.map((t) =>
                t.filePath === filePath ? { ...t, content: "", loaded: true } : t
              );
            }
            return [...prev2, { filePath, content: "", loaded: true, type: "html" }];
          });
        });
      return [...prev, { filePath, content: "", loaded: false, type: "html" }];
    });
  }, [docsPath, message]);

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
      body: JSON.stringify({ path: `${docsPath}/${filePath}`, content: markdown }),
    });
  }, [docsPath]);

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
      setActiveChatTitle(chatData.title || "New Chat");
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
      // fallback: just switch to chat tab
      setActiveTabId("__chat__");
    }
  }, []);

  const handleNewChat = useCallback(() => {
    router.push(`/chat/new?project=${projectId}`);
  }, [router, projectId]);

  const handleNavigateToDocument = useCallback(async (documentPath: string) => {
    try {
      const res = await fetch(`/api/fs/document?path=${docsPath}/${documentPath}`);
      if (res.status === 404) {
        alert("该文档已被删除");
        return;
      }
      if (!res.ok) return;
    } catch {
      return;
    }
    const node: TreeNode = { name: documentPath.split("/").pop() || documentPath, type: "file", path: documentPath };
    handleFileClick(node);
  }, [docsPath, handleFileClick]);

  return (
    <div className="flex h-full">
      {/* Left: File tree sidebar */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 bg-gray-50 shrink-0">
        <div className="px-3 h-[41px] flex items-center border-b border-gray-200 bg-white">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{projectName} Documents</h3>
        </div>

        <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1">
          <button
            onClick={() => handleCreateFile("")}
            disabled={renamingPath !== null}
            className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            Document
          </button>
          <button
            onClick={() => handleCreateDir("")}
            disabled={renamingPath !== null}
            className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            Folder
          </button>
        </div>

        <FileTree
          tree={tree}
          mode="editable"
          selectedPath={activeTabId !== "__chat__" && activeTabId !== PROJECT_INFO_TAB ? activeTabId : null}
          onFileClick={(node) => handleFileClick(node)}
          onNewDirectory={(parentPath) => handleCreateDir(parentPath)}
          onNewFile={(parentPath) => handleCreateFile(parentPath)}
          onDeleteDirectory={(dirPath) => handleDeleteDir(dirPath)}
          onDeleteFile={(filePath) => handleDeleteFile(filePath)}
          onMentionFile={(node) => {
            if (floatingChatOpen && !floatingChatMinimized) {
              setFloatingMentionFile(node.path);
            } else {
              setMentionFile(node.path);
              setActiveTabId("__chat__");
            }
          }}
          renamingPath={renamingPath}
          renamingName={renamingName}
          onRenamingNameChange={setRenamingName}
          onRenameConfirm={handleRenameConfirm}
          onRenameCancel={handleRenameCancel}
          renameInputRef={renameInputRef}
          onStartRename={handleStartRename}
        />
      </div>

      {/* Right: Tab system */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center h-[41px] bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
          {/* Project Info tab (fixed, first) */}
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
            Project Info
          </button>

          {/* Chat tab */}
          <button
            onClick={() => setActiveTabId("__chat__")}
            className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTabId === "__chat__"
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
              onClick={(e) => { e.stopPropagation(); openFloatingChat(projectId); }}
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
                {tab.type === "html" ? (
                  <svg
                    className="w-3.5 h-3.5 shrink-0 text-orange-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="HTML tab"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <polyline points="9 13 7 15 9 17" />
                    <polyline points="15 13 17 15 15 17" />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-label="Markdown tab"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
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
              projectId={projectId}
              projectName={projectName}
              projectMeta={projectMeta}
              projectPath={projectPath}
              recentChats={recentChats}
              recentDocuments={recentDocuments}
              onSwitchToChat={handleSwitchToChat}
              onNewChat={handleNewChat}
              onNavigateToDocument={handleNavigateToDocument}
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
              projectId={projectId}
              projectName={projectName}
              openFileTabs={tabs.map(t => ({
                fileName: t.filePath.split("/").pop() || t.filePath,
                filePath: t.filePath,
              }))}
              onBack={undefined}
              mentionFile={mentionFile}
              onMentionConsumed={() => setMentionFile(null)}
              onToolCall={({ toolName, input }) => {
                if (toolName === "refresh_file_tree") {
                  router.refresh();
                } else if (toolName === "preview_html" && input && typeof input.path === "string") {
                  handlePreviewHtml(input.path);
                }
              }}
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
                  onSave={(content) => handleFileSave(tab.filePath, content)}
                  onContentChange={(content) => handleFileChange(tab.filePath, content)}
                />
              ) : tab.loaded ? (
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
      </div>
    </div>
  );
}

/** Insert a node into the tree under the given parent path */
function insertNode(nodes: TreeNode[], parentPath: string, newNode: TreeNode): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === parentPath) {
      return { ...node, children: [...(node.children || []), newNode] };
    }
    if (node.children) {
      return { ...node, children: insertNode(node.children, parentPath, newNode) };
    }
    return node;
  });
}
