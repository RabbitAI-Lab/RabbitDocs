"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { Modal, Input, Spin, message } from "antd";

interface TreeNode {
  name: string;
  type: "directory" | "file";
  children?: TreeNode[];
  path: string;
}

interface SaveToDocumentModalProps {
  open: boolean;
  projectId: string | undefined;
  content: string;
  onClose: () => void;
  onSaved: (docPath: string) => void;
}

export default function SaveToDocumentModal({
  open,
  projectId,
  content,
  onClose,
  onSaved,
}: SaveToDocumentModalProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDir, setSelectedDir] = useState<string>("");
  const [overwriteTarget, setOverwriteTarget] = useState<TreeNode | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const toggleDirExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Fetch tree when modal opens and projectId is set
  useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setSelectedDir("");
      setOverwriteTarget(null);
      setFilename("");

      return authFetch(`/api/fs/tree?path=personal/default/projects/${projectId}/docs`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load file tree");
          return r.json();
        })
        .then((data: TreeNode[]) => {
          if (cancelled) return;
          setTree(data);
        })
        .catch(() => {
          if (cancelled) return;
          setError("加载文件树失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleDirClick = (node: TreeNode) => {
    setSelectedDir(node.path);
    setOverwriteTarget(null);
    setFilename("");
  };

  const handleFileClick = (node: TreeNode) => {
    setOverwriteTarget(node);
    setFilename(node.name);
    setSelectedDir("");
  };

  const handleSave = async () => {
    if (!projectId) return;

    setSaving(true);
    let docPath: string;

    if (overwriteTarget) {
      docPath = overwriteTarget.path;
    } else if (selectedDir) {
      docPath = `${selectedDir}/${filename.trim()}`;
    } else {
      // Save at project root
      docPath = `personal/default/projects/${projectId}/docs/${filename.trim()}`;
    }

    try {
      const res = await authFetch("/api/fs/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: docPath, content }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSaved(docPath);
    } catch {
      message.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const renderTree = (nodes: TreeNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = expandedPaths.has(node.path);
      return (
        <div key={node.path}>
          {node.type === "directory" ? (
            <div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleDirClick(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDirClick(node);
                  }
                }}
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors cursor-pointer select-none ${
                  selectedDir === node.path
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700"
                }`}
                style={{ paddingLeft: `${8 + level * 14}px` }}
              >
                {/* Chevron: 折叠 = chevron-right, 展开 = rotate-90 → chevron-down */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDirExpand(node.path);
                  }}
                  className="shrink-0 p-0.5 -ml-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                  tabIndex={-1}
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-150 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-amber-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <span className="truncate">{node.name}</span>
              </div>
              {isExpanded &&
                node.children &&
                node.children.length > 0 &&
                renderTree(node.children, level + 1)}
            </div>
          ) : (
            <div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleFileClick(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFileClick(node);
                  }
                }}
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors cursor-pointer select-none ${
                  overwriteTarget?.path === node.path
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                }`}
                style={{ paddingLeft: `${8 + level * 14}px` }}
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-blue-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate flex-1">{node.name}</span>
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  const canSave = !loading && !saving && (!!overwriteTarget || filename.trim().length > 0);

  // Derive display path for the breadcrumb hint
  const getSavePathHint = (): string => {
    if (selectedDir) {
      const parts = selectedDir.split("/");
      const last = parts[parts.length - 1] || "";
      return last || selectedDir;
    }
    return "项目根目录";
  };

  return (
    <Modal
      title="保存到文档"
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              canSave
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* File tree area */}
        <div className="border border-gray-200 dark:border-zinc-700 rounded max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spin size="small" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{error}</span>
              <button
                onClick={() => {
                  if (!projectId) return;
                  setLoading(true);
                  setError(null);
                  authFetch(`/api/fs/tree?path=personal/default/projects/${projectId}/docs`)
                    .then((r) => {
                      if (!r.ok) throw new Error("Failed");
                      return r.json();
                    })
                    .then((data: TreeNode[]) => setTree(data))
                    .catch(() => setError("加载文件树失败"))
                    .finally(() => setLoading(false));
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                重试
              </button>
            </div>
          ) : tree.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-gray-400 dark:text-gray-500">No documents</span>
            </div>
          ) : (
            <div className="py-1">{renderTree(tree)}</div>
          )}
        </div>

        {/* Save path hint */}
        <div className="text-xs text-gray-400 dark:text-gray-500">
          将保存到: {getSavePathHint()}
        </div>

        {/* Filename input */}
        <Input
          placeholder="输入文档名称（不含 .md）"
          value={filename}
          onChange={(e) => {
            setFilename(e.target.value);
            if (overwriteTarget) setOverwriteTarget(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) handleSave();
          }}
          disabled={saving}
          size="small"
        />

        {/* Overwrite warning */}
        {overwriteTarget && (
          <div className="text-xs text-amber-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            将覆盖现有文档: {overwriteTarget.name}
          </div>
        )}
      </div>
    </Modal>
  );
}
