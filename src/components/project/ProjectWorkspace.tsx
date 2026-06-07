"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { useRouter } from "next/navigation";
import { App } from "antd";
import { useFloatingChat } from "@/components/chat/FloatingChatContext";
import { TreeNode, computeDefaultDirName, computeDefaultFileName, findChildren, findNodeByPath, renameNodeInTree, insertNode } from "@/lib/tree";
import type { FileTab, ProjectWorkspaceProps } from "./types";
import { PROJECT_INFO_TAB, CHAT_TAB } from "./types";
import ProjectSidebar from "./ProjectSidebar";
import ProjectTabBar from "./ProjectTabBar";
import ProjectEditorArea from "./ProjectEditorArea";
import type { TreeViewMode } from "@/components/ui/FileTreeFooter";

export default function ProjectWorkspace({
  projectName,
  projectPath,
  docsPath,
  tree: initialTree,
  rootTree: initialRootTree,
  rootPath: _rootPath,
  selectedFile,
  initialContent,
  projectMeta,
  recentChats,
  recentDocuments,
  ownerUser,
  initialChatId,
  initialSubTab,
  autoOpenChat,
}: ProjectWorkspaceProps) {
  const t = useTranslations('project');
  const router = useRouter();
  const { message } = App.useApp();
  const { open: openFloatingChat, isOpen: floatingChatOpen, isMinimized: floatingChatMinimized, setMentionFile: setFloatingMentionFile } = useFloatingChat();

  // Chat state
  const [chatKey, setChatKey] = useState(0);
  const { authFetch } = useAuth();
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("New Chat");
  const [activeChatMessages, setActiveChatMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string }>>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();

  // File tree controls
  const [tree, setTree] = useState<TreeNode[]>(initialTree);
  const [rootTree, setRootTree] = useState<TreeNode[]>(initialRootTree);
  const [treeView, setTreeView] = useState<TreeViewMode>("docs");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetPath = useRef<string>("");
  const [mentionFile, setMentionFile] = useState<string | null>(null);

  // Sync tree when server props change (after router.refresh())
  useEffect(() => {
    if (renamingPath === null) {
      Promise.resolve().then(() => setTree(initialTree));
    }
  }, [initialTree, renamingPath]);

  useEffect(() => {
    if (renamingPath === null) {
      Promise.resolve().then(() => setRootTree(initialRootTree));
    }
  }, [initialRootTree, renamingPath]);

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
  const [activeTabId, setActiveTabId] = useState<string>(
    autoOpenChat ? CHAT_TAB : PROJECT_INFO_TAB
  );
  const contentCache = useRef<Record<string, string>>(
    selectedFile && initialContent !== undefined ? { [selectedFile]: initialContent } : {}
  );

  const projectId = projectPath.split("/")[1] || "";

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
  }, [tree, docsPath, router, authFetch]);

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
  }, [tree, docsPath, router, authFetch]);

  // --- Upload functions ---
  const triggerUpload = useCallback((parentPath: string) => {
    uploadTargetPath.current = parentPath;
    uploadInputRef.current?.click();
  }, []);

  const handleUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const parentPath = uploadTargetPath.current;
    for (const file of Array.from(files)) {
      let filename = file.name;
      if (filename.endsWith(".txt")) {
        filename = filename.replace(/\.txt$/, ".md");
      }
      if (!filename.endsWith(".md") && !filename.endsWith(".html")) continue;
      const content = await file.text();
      const fullPath = parentPath
        ? `${docsPath}/${parentPath}/${filename}`
        : `${docsPath}/${filename}`;
      await authFetch("/api/fs/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath, content }),
      });
      const relativePath = parentPath ? `${parentPath}/${filename}` : filename;
      const fileType = filename.toLowerCase().endsWith(".html") ? "html" as const : "markdown" as const;
      contentCache.current[relativePath] = content;
      setTabs((prev) => [...prev, { filePath: relativePath, content, loaded: true, type: fileType }]);
      setActiveTabId(relativePath);
    }
    router.refresh();
    e.target.value = "";
  }, [docsPath, router, authFetch]);

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
  }, [renamingPath, renamingName, tree, docsPath, router, authFetch, message, t]);

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
  }, [docsPath, authFetch]);

  // Open (or switch to) an HTML file in a tab. Triggered by preview_html client tool.
  const handlePreviewHtml = useCallback(async (filePath: string) => {
    if (!filePath || !filePath.toLowerCase().endsWith(".html")) {
      message.warning(t('onlyHtmlPreview'));
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
  }, [docsPath, message, authFetch, t]);

  const handleRefreshFileContent = useCallback((filePath: string) => {
    setTabs((prev) => {
      if (!prev.some((t) => t.filePath === filePath)) return prev;
      authFetch(`/api/fs/document?path=${docsPath}/${filePath}`)
        .then((r) => {
          if (!r.ok) throw new Error("fetch failed");
          return r.json();
        })
        .then((data) => {
          const content = data.content ?? "";
          contentCache.current[filePath] = content;
          setTabs((prev2) => prev2.map((t) =>
            t.filePath === filePath ? { ...t, content, loaded: true } : t
          ));
        })
        .catch(() => {});
      return prev;
    });
  }, [docsPath, authFetch]);

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
    await authFetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${docsPath}/${filePath}`, content: markdown }),
    });
  }, [docsPath, authFetch]);

  const handleFileChange = useCallback((filePath: string, markdown: string) => {
    contentCache.current[filePath] = markdown;
  }, []);

  // --- Chat navigation from ProjectInfoTab ---

  const handleSwitchToChat = useCallback(async (chatId: number) => {
    try {
      const [chatRes, msgRes] = await Promise.all([
        authFetch(`/api/chats/${chatId}`),
        authFetch(`/api/chats/${chatId}/messages`),
      ]);
      const chatData = await chatRes.json();
      const msgData = await msgRes.json();

      setActiveChatId(chatId);
      setActiveChatTitle(chatData.title || t('newChat'));
      setActiveChatMessages(
        (Array.isArray(msgData) ? msgData : msgData.messages || []).map((m: Record<string, unknown>) => ({
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
  }, [authFetch, t]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveChatTitle("New Chat");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setChatKey((k) => k + 1);
    setActiveTabId(CHAT_TAB);
  }, []);

  const handleNavigateToDocument = useCallback(async (documentPath: string) => {
    try {
      const res = await authFetch(`/api/fs/document?path=${docsPath}/${documentPath}`);
      if (res.status === 404) {
        alert(t('documentDeleted'));
        return;
      }
      if (!res.ok) return;
    } catch {
      return;
    }
    const node: TreeNode = { name: documentPath.split("/").pop() || documentPath, type: "file", path: documentPath };
    handleFileClick(node);
  }, [docsPath, handleFileClick, authFetch, t]);

  // --- Derived state ---

  const selectedPath = activeTabId !== CHAT_TAB && activeTabId !== PROJECT_INFO_TAB ? activeTabId : null;

  // 如果从 URL 参数传入 chatId，自动加载该 chat
  useEffect(() => {
    if (initialChatId) {
      Promise.resolve().then(() => handleSwitchToChat(initialChatId));
    }
  }, [initialChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 清理 URL 中的 ?openChat=true 参数，避免刷新时重复打开 Chat tab
  useEffect(() => {
    if (autoOpenChat && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("openChat")) {
        url.searchParams.delete("openChat");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    }
  }, [autoOpenChat]);

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
      {/* Left: File tree sidebar */}
      <ProjectSidebar
        projectName={projectName}
        tree={tree}
        rootTree={rootTree}
        activeView={treeView}
        onViewChange={setTreeView}
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
        onUpload={triggerUpload}
        onRefresh={() => router.refresh()}
      />

      {/* Right: Tab system */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        <ProjectTabBar
          activeTabId={activeTabId}
          tabs={tabs}
          projectId={projectId}
          onTabSelect={setActiveTabId}
          onTabClose={handleTabClose}
          onOpenFloatingChat={openFloatingChat}
        />

        <ProjectEditorArea
          activeTabId={activeTabId}
          tabs={tabs}
          projectId={projectId}
          projectName={projectName}
          projectPath={projectPath}
          docsPath={docsPath}
          projectMeta={projectMeta}
          recentChats={recentChats}
          recentDocuments={recentDocuments}
          ownerUser={ownerUser}
          chatKey={chatKey}
          activeChatId={activeChatId}
          activeChatTitle={activeChatTitle}
          activeChatMessages={activeChatMessages}
          activeChatModelId={activeChatModelId}
          activeChatTemplateId={activeChatTemplateId}
          mentionFile={mentionFile}
          onSwitchToChat={handleSwitchToChat}
          onNewChat={handleNewChat}
          onNavigateToDocument={handleNavigateToDocument}
          onMentionConsumed={() => setMentionFile(null)}
          onFileSave={handleFileSave}
          onFileChange={handleFileChange}
          onToolCall={({ toolName, input }) => {
            if (toolName === "refresh_file_tree") {
              router.refresh();
            } else if (toolName === "preview_html" && input && typeof input.path === "string") {
              handlePreviewHtml(input.path);
            } else if (toolName === "refresh_file_content" && input && typeof input.path === "string") {
              handleRefreshFileContent(input.path);
            }
          }}
          getCachedContent={(filePath) => contentCache.current[filePath]}
          initialSubTab={initialSubTab}
        />
      </div>
    </div>
  );
}
