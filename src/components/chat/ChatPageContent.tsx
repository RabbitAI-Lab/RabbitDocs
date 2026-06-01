"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import FileTree from "@/components/ui/FileTree";
import ProjectInfoTab from "@/components/project/ProjectInfoTab";
import { TreeNode, stripTreePrefix } from "@/lib/tree";
import type { Repository, ProjectMeta as ProjectMetaType } from "@/lib/fs";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-2" />
      加载编辑器中...
    </div>
  ),
});

const PROJECT_INFO_TAB = "__project_info__" as const;
const CHAT_TAB = "__chat__" as const;

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

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

interface ChatPageContentProps {
  chatId: number;
  chatTitle: string;
  initialMessages: Message[];
  initialModelId?: number;
  initialTemplateId?: number;
  projectId?: string;
  initialTree: TreeNode[];
  projectName?: string;
  projectMeta?: ProjectMetaType | null;
  recentChats?: RecentChat[];
}

function computeDefaultDirName(existingChildren: TreeNode[]): string {
  const baseName = "新建文件夹";
  const existingNames = new Set(
    existingChildren.filter((n) => n.type === "directory").map((n) => n.name)
  );
  if (!existingNames.has(baseName)) return baseName;
  let i = 1;
  while (existingNames.has(`${baseName}(${i})`)) i++;
  return `${baseName}(${i})`;
}

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

export default function ChatPageContent({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  projectId,
  initialTree,
  projectName,
  projectMeta,
  recentChats,
}: ChatPageContentProps) {
  const router = useRouter();

  // Active chat state
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [activeChatTitle, setActiveChatTitle] = useState(chatTitle);
  const [activeChatMessages, setActiveChatMessages] = useState(initialMessages);
  const [activeChatModelId, setActiveChatModelId] = useState(initialModelId);
  const [activeChatTemplateId, setActiveChatTemplateId] = useState(initialTemplateId);
  const [chatKey, setChatKey] = useState(0);

  // File tree state
  const [tree, setTree] = useState<TreeNode[]>(initialTree);
  const [treeLoading, setTreeLoading] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [newDirParent, setNewDirParent] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParent, setNewFileParent] = useState("");
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Tab system state
  const [activeTabId, setActiveTabId] = useState<string>(CHAT_TAB);
  const [fileTabs, setFileTabs] = useState<FileTab[]>([]);
  const contentCache = useRef<Record<string, string>>({});

  const docsPath = projectId ? `personal/default/projects/${projectId}/docs` : "";

  const refreshTree = async () => {
    if (!projectId) return;
    setTreeLoading(true);
    const prefix = `personal/default/projects/${projectId}/docs`;
    try {
      const res = await fetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);
  };

  // --- Chat switching ---

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
        (Array.isArray(msgData) ? msgData : msgData.messages || []).map(
          (m: { id: number; role: "user" | "assistant"; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })
        )
      );
      setActiveChatModelId(chatData.modelId);
      setActiveChatTemplateId(chatData.templateId);
      setChatKey((k) => k + 1);
      setActiveTabId(CHAT_TAB);
      window.history.replaceState(null, "", `/chat/${chatId}`);
    } catch {
      setActiveTabId(CHAT_TAB);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    router.push("/chat/new");
  }, [router]);

  // --- File tree functions ---

  const handleStartNewDir = useCallback(
    (parentPath: string) => {
      const children = parentPath ? findChildren(tree, parentPath) : tree;
      const defaultName = computeDefaultDirName(children);
      setNewDirParent(parentPath);
      setNewDirName(defaultName);
      setShowNewDir(true);
      setTimeout(() => dirInputRef.current?.select(), 0);
    },
    [tree]
  );

  const handleCreateDir = async () => {
    if (!newDirName.trim() || !projectId) return;
    const fullPath = newDirParent
      ? `${docsPath}/${newDirParent}/${newDirName.trim()}`
      : `${docsPath}/${newDirName.trim()}`;
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
      body: JSON.stringify({ path: `${docsPath}/${dirPath}` }),
    });
    refreshTree();
  };

  const handleDeleteFile = async (filePath: string) => {
    const name = filePath.split("/").pop() || filePath;
    if (!confirm(`确认删除文档 "${name}"?`)) return;
    await fetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${filePath}` }),
    });
    if (fileTabs.some((t) => t.filePath === filePath)) {
      handleFileTabClose(filePath);
    }
    refreshTree();
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !projectId) return;
    const fullPath = newFileParent
      ? `${docsPath}/${newFileParent}/${newFileName.trim()}`
      : `${docsPath}/${newFileName.trim()}`;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: fullPath,
        content: `# ${newFileName.trim()}\n\n`,
      }),
    });
    const relativePath = newFileParent
      ? `${newFileParent}/${newFileName.trim()}`
      : newFileName.trim();
    setShowNewFile(false);
    setNewFileName("");
    setNewFileParent("");
    refreshTree();
    // Open the new file as a tab
    const initialContent = `# ${newFileName.trim()}\n\n`;
    contentCache.current[relativePath] = initialContent;
    setFileTabs((prev) => [...prev, { filePath: relativePath, content: initialContent, loaded: true }]);
    setActiveTabId(relativePath);
  };

  // --- File tab functions ---

  const handleFileClick = useCallback((node: TreeNode) => {
    const filePath = node.path;
    setFileTabs((prev) => {
      const existingTab = prev.find((t) => t.filePath === filePath);
      if (existingTab) {
        setActiveTabId(filePath);
        return prev;
      }
      const cachedContent = contentCache.current[filePath] ?? "";
      const newTab: FileTab = {
        filePath,
        content: cachedContent,
        loaded: !!cachedContent,
      };
      setActiveTabId(filePath);

      if (!cachedContent) {
        fetch(`/api/fs/document?path=${docsPath}/${filePath}`)
          .then((r) => r.json())
          .then((data) => {
            const content = data.content ?? "";
            contentCache.current[filePath] = content;
            setFileTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content, loaded: true } : t
              )
            );
          })
          .catch(() => {
            setFileTabs((prev2) =>
              prev2.map((t) =>
                t.filePath === filePath ? { ...t, content: "", loaded: true } : t
              )
            );
          });
      }

      return [...prev, newTab];
    });
  }, [docsPath]);

  const handleFileTabClose = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFileTabs((prev) => {
      const idx = prev.findIndex((t) => t.filePath === tabId);
      const newTabs = prev.filter((t) => t.filePath !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length === 0) {
          setActiveTabId(CHAT_TAB);
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

  const handleToolCall = ({ toolName }: { toolName: string; args: Record<string, unknown> }) => {
    if (toolName === "refresh_file_tree") {
      refreshTree();
    }
  };

  // --- Render: no project ---

  if (!projectId) {
    return (
      <div className="flex flex-col h-full">
        {/* Tab Bar */}
        <div className="flex items-center h-[41px] bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTabId(CHAT_TAB)}
            className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTabId === CHAT_TAB
                ? "bg-white text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            对话
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 relative">
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
              projectId={projectId}
              onSwitchToChat={handleSwitchToChat}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Render: has project (mirrors ProjectWorkspace) ---

  return (
    <div className="flex h-full">
      {/* Left Panel - File Tree */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 bg-gray-50 shrink-0">
        {/* Project header */}
        <div className="px-3 h-[41px] border-b border-gray-200 bg-white flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {projectName || projectId} 文档
          </h3>
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
                onClick={() => {
                  setShowNewFile(false);
                  setNewFileName("");
                  setNewFileParent("");
                }}
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
            selectedPath={activeTabId !== CHAT_TAB && activeTabId !== PROJECT_INFO_TAB ? activeTabId : null}
            onFileClick={(node) => handleFileClick(node)}
            onNewDirectory={(parentPath) => handleStartNewDir(parentPath)}
            onNewFile={(parentPath) => {
              setNewFileParent(parentPath);
              setShowNewFile(true);
            }}
            onDeleteDirectory={(dirPath) => handleDeleteDir(dirPath)}
            onDeleteFile={(filePath) => handleDeleteFile(filePath)}
            onMentionFile={(node) => {
              setMentionFile(node.path);
              setActiveTabId(CHAT_TAB);
            }}
            creatingDirParent={showNewDir ? newDirParent : null}
            creatingDirName={newDirName}
            onCreatingDirNameChange={setNewDirName}
            onCreatingDirConfirm={handleCreateDir}
            onCreatingDirCancel={handleCancelNewDir}
            dirInputRef={dirInputRef}
          />
        )}
      </div>

      {/* Right Panel - Tab System */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
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
            onClick={() => setActiveTabId(CHAT_TAB)}
            className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTabId === CHAT_TAB
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
          {fileTabs.map((tab) => {
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
                  onClick={(e) => handleFileTabClose(tab.filePath, e)}
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
              projectName={projectName || projectId}
              projectMeta={projectMeta ?? null}
              projectPath={`personal/default/projects/${projectId}`}
              recentChats={recentChats || []}
              onSwitchToChat={handleSwitchToChat}
              onNewChat={handleNewChat}
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
              onDocumentSaved={refreshTree}
              mentionFile={mentionFile}
              onMentionConsumed={() => setMentionFile(null)}
              onToolCall={handleToolCall}
              onSwitchToChat={handleSwitchToChat}
            />
          </div>

          {/* File editor tabs */}
          {fileTabs.map((tab) => (
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
      </div>
    </div>
  );
}
