"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useRouter } from "next/navigation";
import { App } from "antd";
import { useFloatingChat } from "@/components/chat/FloatingChatContext";
import { TreeNode, computeDefaultDirName, computeDefaultFileName, findChildren, findNodeByPath, renameNodeInTree, insertNode } from "@/lib/tree";
import type { DocumentActivity } from "@/lib/types";
import type { WorkspaceMeta, ProjectMeta } from "@/lib/fs";

import type { FileTab } from "./types";
import { WORKSPACE_INFO_TAB, CHAT_TAB } from "./types";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceTabBar from "./WorkspaceTabBar";
import WorkspaceEditorArea from "./WorkspaceEditorArea";

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
  projectId: string | null;
}

interface WorkspaceDetailProps {
  workspaceMeta: WorkspaceMeta;
  linkedProjects: ProjectMeta[];
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
  accountType: string;
  accountId: string;
  initialChatId?: number;
  tree: TreeNode[];
  docsPath: string;
  selectedFile: string | null;
  initialContent: string;
}

export default function WorkspaceDetail({
  workspaceMeta,
  linkedProjects,
  recentChats,
  recentDocuments,
  accountType,
  accountId,
  initialChatId,
  tree: initialTree,
  docsPath,
  selectedFile,
  initialContent,
}: WorkspaceDetailProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const t = useTranslations('workspace');
  const tc = useTranslations('chat');
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();

  // Tab 系统
  const initTab = selectedFile && initialContent !== undefined
    ? [{
        filePath: selectedFile,
        content: initialContent,
        loaded: true,
        type: (selectedFile.toLowerCase().endsWith(".html") ? "html" : "markdown") as "markdown" | "html",
      }]
    : [];
  const [tabs, setTabs] = useState<FileTab[]>(initTab);
  const { authFetch } = useAuth();
  const [activeTabId, setActiveTabId] = useState<string>(
    initialChatId ? CHAT_TAB : (selectedFile ? selectedFile : WORKSPACE_INFO_TAB)
  );
  const contentCache = useRef<Record<string, string>>(
    selectedFile && initialContent !== undefined ? { [selectedFile]: initialContent } : {}
  );

  // Chat 状态
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

  // dirSegments: ["personal", "default", "workspace", "{workspaceId}"]
  const workspacePath = `${accountType}/${accountId}/workspace/${workspaceMeta.id}`;

  // Sync tree when server props change (after router.refresh())
  useEffect(() => {
    if (renamingPath === null) {
      setTree(initialTree);
    }
  }, [initialTree, renamingPath]);

  // --- File tree functions ---

  const handleCreateFile = useCallback(async (parentPath: string) => {
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultFileName(children);
    const baseName = defaultName.replace(/\.md$/, "");
    const fullPath = parentPath
      ? `${docsPath}/${parentPath}/${defaultName}`
      : `${docsPath}/${defaultName}`;
    await authFetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath, content: `# ${baseName}\n\n` }),
    });
    const relativePath = parentPath ? `${parentPath}/${defaultName}` : defaultName;
    const newNode: TreeNode = { name: defaultName, type: "file", path: relativePath };
    setTree((prev) => {
      if (!parentPath) return [...prev, newNode];
      return insertNode(prev, parentPath, newNode);
    });
    setRenamingPath(relativePath);
    setRenamingName(defaultName);
    setTimeout(() => renameInputRef.current?.select(), 0);
    const fileContent = `# ${baseName}\n\n`;
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
    await authFetch("/api/fs/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    const relativePath = parentPath ? `${parentPath}/${defaultName}` : defaultName;
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

    // For files, ensure a valid extension is present
    let finalName = trimmedName;
    if (node.type === "file") {
      const hasValidExt = /\.(md|html)$/.test(finalName);
      if (!hasValidExt) {
        const ext = node.name.match(/\.(md|html)$/)?.[0] ?? ".md";
        finalName = `${finalName}${ext}`;
      }
    }

    let res: Response;
    if (node.type === "file") {
      res = await authFetch("/api/fs/document", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${docsPath}/${currentPath}`, newTitle: finalName }),
      });
    } else {
      res = await authFetch("/api/fs/directory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${docsPath}/${currentPath}`, newName: finalName }),
      });
    }

    if (res.status === 409) {
      const data = await res.json();
      message.warning(data.error || t('nameConflict'));
      setTimeout(() => renameInputRef.current?.focus(), 0);
      return;
    }

    // Update tab paths for file renames
    if (node.type === "file") {
      const newPath = currentPath.includes("/")
        ? currentPath.replace(/[^/]*$/, finalName)
        : finalName;
      updateTabPaths(currentPath, newPath);
    }

    setTree((prev) => renameNodeInTree(prev, currentPath, finalName));
    setRenamingPath(null);
    router.refresh();
  }, [renamingPath, renamingName, tree, docsPath, router, message]);

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
    await authFetch("/api/fs/directory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${dirPath}` }),
    });
    router.refresh();
  };

  const handleDeleteFile = async (filePath: string) => {
    await authFetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${filePath}` }),
    });
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

      if (!cachedContent) {
        authFetch(`/api/fs/document?path=${docsPath}/${filePath}`)
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
      message.warning(tc('previewHtml.onlyHtml'));
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
      setActiveTabId(filePath);
      authFetch(`/api/fs/document?path=${docsPath}/${filePath}`)
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
          setActiveTabId(WORKSPACE_INFO_TAB);
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
    await authFetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${filePath}`, content: markdown }),
    });
  }, [docsPath]);

  const handleFileChange = useCallback((filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
  }, []);

  // --- Chat navigation ---

  const handleSwitchToChat = useCallback(
    async (chatId: number, projectId: string | null) => {
      try {
        const [chatRes, msgRes] = await Promise.all([
          authFetch(`/api/chats/${chatId}`),
          authFetch(`/api/chats/${chatId}/messages`),
        ]);
        const chatData = await chatRes.json();
        const msgData = await msgRes.json();

        setActiveChatId(chatId);
        setActiveChatTitle(chatData.title || "New Chat");
        setActiveChatMessages(
          (Array.isArray(msgData) ? msgData : []).map((m: Record<string, unknown>) => ({
            id: m.id as number,
            role: m.role as "user" | "assistant",
            content: m.content as string,
            isError: !!m.isError,
          }))
        );
        setActiveChatModelId(chatData.modelId);
        setActiveChatTemplateId(chatData.templateId);
        setChatKey((k) => k + 1);
        setActiveTabId(CHAT_TAB);
      } catch {
        setActiveTabId(CHAT_TAB);
      }
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveChatTitle(t('newChat'));
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setChatKey((k) => k + 1);
    setActiveTabId(CHAT_TAB);
  }, []);

  // 点击 Activity 标签中的 document：跳转到 document 所属 project 的 ProjectWorkspace
  const handleNavigateToDocument = useCallback(
    (documentPath: string, projectId: string) => {
      if (!projectId) return;
      router.push(
        `/project/${accountType}/${accountId}/projects/${projectId}?file=${encodeURIComponent(documentPath)}`,
      );
    },
    [router, accountType, accountId],
  );

  // 删除 workspace 后跳回 home
  const handleWorkspaceDeleted = useCallback(() => {
    router.push("/");
  }, [router]);

  // 如果从 URL 参数传入 chatId，自动加载该 chat
  useEffect(() => {
    if (initialChatId) {
      handleSwitchToChat(initialChatId, null);
    }
  }, [initialChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Derived state ---

  const selectedPath = activeTabId !== CHAT_TAB && activeTabId !== WORKSPACE_INFO_TAB ? activeTabId : null;

  return (
    <div className="flex h-full">
      {/* Left: File tree sidebar */}
      <WorkspaceSidebar
        workspaceName={workspaceMeta.name}
        tree={tree}
        selectedPath={selectedPath}
        isRenaming={renamingPath !== null}
        renamingPath={renamingPath}
        renamingName={renamingName}
        renameInputRef={renameInputRef}
        onCreateFile={handleCreateFile}
        onCreateDir={handleCreateDir}
        onFileClick={handleFileClick}
        onDeleteFile={handleDeleteFile}
        onDeleteDir={handleDeleteDir}
        onMentionFile={(node) => {
          if (floatingChatOpen && !floatingChatMinimized) {
            setFloatingMentionFile(node.path);
          } else {
            setMentionFile(node.path);
            setActiveTabId(CHAT_TAB);
          }
        }}
        onStartRename={handleStartRename}
        onRenameConfirm={handleRenameConfirm}
        onRenameCancel={handleRenameCancel}
        onRenamingNameChange={setRenamingName}
      />

      {/* Right: Tab system */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        <WorkspaceTabBar
          activeTabId={activeTabId}
          tabs={tabs}
          workspaceId={workspaceMeta.id}
          onTabSelect={setActiveTabId}
          onTabClose={handleTabClose}
          onOpenFloatingChat={openFloatingChat}
        />

        <WorkspaceEditorArea
          activeTabId={activeTabId}
          tabs={tabs}
          docsPath={docsPath}
          workspaceId={workspaceMeta.id}
          workspaceName={workspaceMeta.name}
          workspacePath={workspacePath}
          workspaceMeta={workspaceMeta}
          linkedProjects={linkedProjects}
          recentChats={recentChats}
          recentDocuments={recentDocuments}
          accountType={accountType}
          accountId={accountId}
          chatKey={chatKey}
          activeChatId={activeChatId}
          activeChatTitle={activeChatTitle}
          activeChatMessages={activeChatMessages}
          activeChatModelId={activeChatModelId}
          activeChatTemplateId={activeChatTemplateId}
          mentionFile={mentionFile}
          workspaceIdForChat={workspaceMeta.id}
          onSwitchToChat={handleSwitchToChat}
          onNewChat={handleNewChat}
          onNavigateToDocument={handleNavigateToDocument}
          onWorkspaceDeleted={handleWorkspaceDeleted}
          onMentionConsumed={() => setMentionFile(null)}
          onFileSave={handleFileSave}
          onFileChange={handleFileChange}
          onToolCall={({ toolName, input }) => {
            if (toolName === "refresh_file_tree") {
              router.refresh();
            } else if (toolName === "preview_html" && input && typeof input.path === "string") {
              handlePreviewHtml(input.path);
            }
          }}
          getCachedContent={(filePath) => contentCache.current[filePath]}
        />
      </div>
    </div>
  );
}
