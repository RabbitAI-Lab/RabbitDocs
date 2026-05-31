"use client";

import { useState, useCallback, useRef } from "react";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import FileTree from "@/components/ui/FileTree";
import { TreeNode, stripTreePrefix } from "@/lib/tree";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
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
}: ChatPageContentProps) {
  const [tree, setTree] = useState<TreeNode[]>(initialTree);
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

  const projectPath = projectId
    ? `personal/default/projects/${projectId}`
    : "";

  const refreshTree = async () => {
    if (!projectId) return;
    setTreeLoading(true);
    const prefix = `personal/default/projects/${projectId}`;
    try {
      const res = await fetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);
  };

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
    refreshTree();
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !projectId) return;
    const fullPath = newFileParent
      ? `${projectPath}/${newFileParent}/${newFileName.trim()}`
      : `${projectPath}/${newFileName.trim()}`;
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: fullPath,
        content: `# ${newFileName.trim()}\n\n`,
      }),
    });
    setShowNewFile(false);
    setNewFileName("");
    setNewFileParent("");
    refreshTree();
  };

  // No project: full-width chat
  if (!projectId) {
    return (
      <ChatWorkspace
        chatId={chatId}
        chatTitle={chatTitle}
        initialMessages={initialMessages}
        initialModelId={initialModelId}
        initialTemplateId={initialTemplateId}
        projectId={projectId}
      />
    );
  }

  const handleToolCall = ({ toolName }: { toolName: string; args: Record<string, unknown> }) => {
    if (toolName === "refresh_file_tree") {
      refreshTree();
    }
  };

  // Has project: split layout with file tree
  return (
    <div className="flex h-full">
      {/* Left Panel - File Tree */}
      <div className="w-[240px] h-full flex flex-col border-r border-gray-200 bg-gray-50 shrink-0">
        {/* Project header */}
        <div className="px-3 h-[41px] border-b border-gray-200 bg-white flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {projectName || projectId}
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
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
              placeholder={
                newFileParent ? `${newFileParent}/文档名` : "文档名"
              }
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
            onNewDirectory={(parentPath) => handleStartNewDir(parentPath)}
            onNewFile={(parentPath) => {
              setNewFileParent(parentPath);
              setShowNewFile(true);
            }}
            onDeleteDirectory={(dirPath) => handleDeleteDir(dirPath)}
            onDeleteFile={(filePath) => handleDeleteFile(filePath)}
            onMentionFile={(node) => setMentionFile(node.path)}
            creatingDirParent={showNewDir ? newDirParent : null}
            creatingDirName={newDirName}
            onCreatingDirNameChange={setNewDirName}
            onCreatingDirConfirm={handleCreateDir}
            onCreatingDirCancel={handleCancelNewDir}
            dirInputRef={dirInputRef}
          />
        )}
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        <ChatWorkspace
          key={chatKey}
          chatId={chatId}
          chatTitle={chatTitle}
          initialMessages={initialMessages}
          initialModelId={initialModelId}
          initialTemplateId={initialTemplateId}
          embedded
          projectId={projectId}
          onDocumentSaved={refreshTree}
          mentionFile={mentionFile}
          onMentionConsumed={() => setMentionFile(null)}
          onToolCall={handleToolCall}
        />
      </div>
    </div>
  );
}
