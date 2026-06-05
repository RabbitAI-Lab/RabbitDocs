"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { App } from "antd";
import type { TreeNode } from "@/lib/tree";
import { stripTreePrefix, computeDefaultDirName, computeDefaultFileName, findChildren, findNodeByPath, renameNodeInTree, insertNode } from "@/lib/tree";

interface UseProjectFileTreeOptions {
  projectId: string | null;
  projectPath: string;
  message: ReturnType<typeof App.useApp>["message"];
  onCloseTab: (tabId: string) => void;
  onUpdateTabPaths: (oldPath: string, newPath: string) => void;
  initialTree?: TreeNode[];
  onFileCreated?: (relativePath: string, content: string) => void;
}

export function useProjectFileTree({
  projectId,
  projectPath,
  message,
  onCloseTab,
  onUpdateTabPaths,
  initialTree: initialTreeProp,
  onFileCreated,
}: UseProjectFileTreeOptions) {
  const [tree, setTree] = useState<TreeNode[]>(initialTreeProp ?? []);
  const { authFetch } = useAuth();
  const [treeLoading, setTreeLoading] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const refreshTree = useCallback(async (targetProjectId?: string) => {
    const pid = targetProjectId ?? projectId;
    if (!pid) return;
    setTreeLoading(true);
    const prefix = `personal/default/projects/${pid}/docs`;
    try {
      const res = await authFetch(`/api/fs/tree?path=${prefix}`);
      const data = await res.json();
      setTree(Array.isArray(data) ? stripTreePrefix(data, prefix) : []);
    } catch {
      setTree([]);
    }
    setTreeLoading(false);
  }, [projectId]);

  const handleCreateFile = useCallback(async (parentPath: string) => {
    if (!projectId) return;
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultFileName(children);
    const baseName = defaultName.replace(/\.md$/, "");
    const fullPath = parentPath
      ? `${projectPath}/${parentPath}/${defaultName}`
      : `${projectPath}/${defaultName}`;
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
    if (onFileCreated) {
      onFileCreated(relativePath, `# ${baseName}\n\n`);
    }
    refreshTree();
  }, [tree, projectId, projectPath, refreshTree, onFileCreated]);

  const handleCreateDir = useCallback(async (parentPath: string) => {
    if (!projectId) return;
    const children = parentPath ? findChildren(tree, parentPath) : tree;
    const defaultName = computeDefaultDirName(children);
    const fullPath = parentPath
      ? `${projectPath}/${parentPath}/${defaultName}`
      : `${projectPath}/${defaultName}`;
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
    refreshTree();
  }, [tree, projectId, projectPath, refreshTree]);

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
        body: JSON.stringify({ path: `${projectPath}/${currentPath}`, newTitle: finalName }),
      });
    } else {
      res = await authFetch("/api/fs/directory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${projectPath}/${currentPath}`, newName: finalName }),
      });
    }

    if (res.status === 409) {
      const data = await res.json();
      message.warning(data.error || "A file or folder with this name already exists");
      setTimeout(() => renameInputRef.current?.focus(), 0);
      return;
    }

    // Update tab paths for file renames
    if (node.type === "file") {
      const newPath = currentPath.includes("/")
        ? currentPath.replace(/[^/]*$/, finalName)
        : finalName;
      onUpdateTabPaths(currentPath, newPath);
    }

    // Optimistically update the local tree so the new name is visible immediately
    setTree((prev) => renameNodeInTree(prev, currentPath, finalName));
    setRenamingPath(null);
    refreshTree();
  }, [renamingPath, renamingName, tree, projectPath, message, onUpdateTabPaths, refreshTree]);

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

  const handleDeleteDir = useCallback(async (dirPath: string) => {
    await authFetch("/api/fs/directory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${dirPath}` }),
    });
    refreshTree();
  }, [projectPath, refreshTree]);

  const handleDeleteFile = useCallback(async (filePath: string) => {
    await authFetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `${projectPath}/${filePath}` }),
    });
    onCloseTab(filePath);
    refreshTree();
  }, [projectPath, onCloseTab, refreshTree]);

  const reset = useCallback(() => {
    setTree([]);
    setRenamingPath(null);
    setRenamingName("");
  }, []);

  return {
    tree,
    setTree,
    treeLoading,
    setTreeLoading,
    renamingPath,
    renamingName,
    setRenamingName,
    renameInputRef,
    refreshTree,
    handleCreateFile,
    handleCreateDir,
    handleRenameConfirm,
    handleRenameCancel,
    handleStartRename,
    handleDeleteDir,
    handleDeleteFile,
    reset,
  };
}
