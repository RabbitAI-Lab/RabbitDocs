"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import FileTree from "@/components/ui/FileTree";
import { TreeNode } from "@/lib/tree";

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

interface ProjectMeta {
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
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
  tree: TreeNode[];
  selectedFile: string | null; // relative path within project, from ?file= URL param
  initialContent: string; // file content preloaded by server
  projectMeta: ProjectMeta | null;
  accountInfo: AccountInfo;
  recentChats: RecentChat[];
}

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

export default function ProjectWorkspace({
  projectName,
  projectPath,
  tree,
  selectedFile,
  initialContent,
}: ProjectWorkspaceProps) {
  const router = useRouter();

  // Chat state
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("新对话");
  const [activeChatMessages, setActiveChatMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string }>>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();

  // File tree controls
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParent, setNewFileParent] = useState("");
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [newDirParent, setNewDirParent] = useState("");
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Tab system state — initialize from URL ?file= param
  const initialTab = selectedFile && initialContent !== undefined
    ? [{ filePath: selectedFile, content: initialContent, loaded: true }]
    : [];
  const [tabs, setTabs] = useState<FileTab[]>(initialTab);
  const [activeTabId, setActiveTabId] = useState<string>(selectedFile || "__chat__");
  const contentCache = useRef<Record<string, string>>(
    selectedFile && initialContent !== undefined ? { [selectedFile]: initialContent } : {}
  );

  const projectId = projectPath.split("/")[3] || "";

  // --- File tree functions ---

  const handleStartNewDir = useCallback((parentPath: string) => {
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultDirName(children);
    setNewDirParent(parentPath);
    setNewDirName(defaultName);
    setShowNewDir(true);
    setTimeout(() => dirInputRef.current?.select(), 0);
  }, [tree]);

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
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
    router.refresh();
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
    router.refresh();
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
    router.refresh();
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const fullPath = newFileParent
      ? `${projectPath}/${newFileParent}/${newFileName.trim()}`
      : `${projectPath}/${newFileName.trim()}`;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath, content: `# ${newFileName.trim()}\n\n` }),
    });
    const relativePath = newFileParent
      ? `${newFileParent}/${newFileName.trim()}`
      : newFileName.trim();
    setShowNewFile(false);
    setNewFileName("");
    setNewFileParent("");
    router.refresh();
    // Open the new file as a tab
    const initialContent = `# ${newFileName.trim()}\n\n`;
    contentCache.current[relativePath] = initialContent;
    setTabs((prev) => [...prev, { filePath: relativePath, content: initialContent, loaded: true }]);
    setActiveTabId(relativePath);
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
      const newTab: FileTab = {
        filePath,
        content: cachedContent,
        loaded: !!cachedContent,
      };
      setActiveTabId(filePath);

      // Fetch content if not cached
      if (!cachedContent) {
        fetch(`/api/fs/document?path=${projectPath}/${filePath}`)
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
  }, [projectPath]);

  const handleTabClose = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.filePath === tabId);
      const newTabs = prev.filter((t) => t.filePath !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length === 0) {
          setActiveTabId("__chat__");
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

  return (
    <div className="flex h-full">
      {/* Left: File tree sidebar */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 bg-gray-50 shrink-0">
        <div className="px-3 h-[41px] flex items-center border-b border-gray-200 bg-white">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{projectName}</h3>
        </div>

        <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1">
          <button
            onClick={() => { setNewFileParent(""); setShowNewFile(true); }}
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

        <FileTree
          tree={tree}
          mode="editable"
          selectedPath={activeTabId !== "__chat__" ? activeTabId : null}
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
      </div>

      {/* Right: Tab system */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center h-[41px] bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
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
              onBack={undefined}
              mentionFile={mentionFile}
              onMentionConsumed={() => setMentionFile(null)}
              onToolCall={({ toolName }) => { if (toolName === "refresh_file_tree") router.refresh(); }}
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
      </div>
    </div>
  );
}
