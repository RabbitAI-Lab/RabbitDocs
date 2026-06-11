"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Editor from "@monaco-editor/react";
import { useAuth } from "@/components/auth/useAuth";
import ShareHtmlButton from "@/components/project/ShareHtmlButton";
import { Button } from "antd";

interface HtmlEditorProps {
  /** Relative path within project, e.g. "docs/foo.html" */
  filePath: string;
  /** Project id (used by share API) */
  projectId: string;
  /** Absolute docs path, e.g. "personal/default/projects/{id}/docs" */
  docsPath: string;
  /** Latest content (parent-owned; updates on external reload) */
  initialValue: string;
  /** Whether initial load has finished */
  loaded: boolean;
  /** Persist content to disk */
  onSave: (content: string) => void | Promise<void>;
  /** Notify parent of in-memory edits (so it can update caches) */
  onContentChange: (content: string) => void;
}

type ViewMode = "edit" | "preview";

export default function HtmlEditor({
  filePath,
  projectId,
  docsPath,
  initialValue,
  loaded,
  onSave,
  onContentChange,
}: HtmlEditorProps) {
  const { authFetch } = useAuth();
  const [content, setContent] = useState<string>(initialValue);
  const [mode, setMode] = useState<ViewMode>("preview");
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 用于强制 iframe 重新挂载的 key，每次从隐藏变为可见时递增
  const [iframeKey, setIframeKey] = useState(0);
  // 容器 div 的 ref，供 IntersectionObserver 观察
  const containerRef = useRef<HTMLDivElement>(null);
  // Snapshot of the last persisted content, used to compute the dirty flag.
  const persistedRef = useRef<string>(initialValue);
  const lastLoadedRef = useRef<string | null>(null);
  const { resolvedTheme } = useTheme();
  const fileName = filePath.split("/").pop() || filePath;

  // When the parent finishes loading or reloads external content, sync our state.
  useEffect(() => {
    if (!loaded) return;
    if (lastLoadedRef.current === filePath) {
      // Tab reused but content refetched: only update if not dirty.
      if (content === persistedRef.current) {
        setContent(initialValue);
        persistedRef.current = initialValue;
      }
      return;
    }
    lastLoadedRef.current = filePath;
    setContent(initialValue);
    persistedRef.current = initialValue;
    setIsDirty(false);
    setMode("preview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialValue, filePath]);

  // 检测容器从隐藏变为可见，强制 iframe 重新挂载
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let wasVisible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        if (isVisible && !wasVisible) {
          setIframeKey((prev) => prev + 1);
        }
        wasVisible = isVisible;
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await authFetch(`/api/fs/document?path=${docsPath}/${filePath}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const fresh = data.content ?? "";
      setContent(fresh);
      persistedRef.current = fresh;
      setIsDirty(false);
      onContentChange(fresh);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [docsPath, filePath, refreshing, onContentChange]);

  const handleChange = (next: string | undefined) => {
    if (typeof next !== "string") return;
    setContent(next);
    setIsDirty(next !== persistedRef.current);
    onContentChange(next);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSave(content);
      persistedRef.current = content;
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--main-bg)' }}>
      {/* Toolbar */}
      <div className="flex items-center h-[38px] px-3 border-b border-gray-200 dark:border-zinc-700 gap-3 shrink-0 bg-transparent">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg
            className="w-3.5 h-3.5 shrink-0 text-orange-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <polyline points="9 13 7 15 9 17" />
            <polyline points="15 13 17 15 15 17" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{fileName}</span>
          {isDirty && (
            <span
              className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500"
              title="有未保存的修改"
              aria-label="有未保存的修改"
            />
          )}
        </div>

        <div className="flex items-center border border-gray-200 dark:border-zinc-600 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`px-2.5 h-7 text-xs transition-colors ${
              mode === "edit"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-600"
            }`}
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`px-2.5 h-7 text-xs transition-colors border-l border-gray-200 dark:border-zinc-600 ${
              mode === "preview"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-600"
            }`}
          >
            预览
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="刷新"
            className={`p-1.5 rounded-md transition-colors ${
              refreshing
                ? "text-gray-300 dark:text-zinc-600 cursor-not-allowed"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          {/* Share button temporarily hidden */}
          {/* <button
            type="button"
            onClick={() => setShareDialogOpen(true)}
            className="px-2.5 h-7 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
            title="生成分享链接"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            分享
          </button> */}
          <Button
            htmlType="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`px-3 h-7 text-xs rounded-md transition-colors ${
              isDirty && !saving
                ? ""
                : ""
            }`}
            type={isDirty && !saving ? "primary" : "default"}
            loading={saving}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {mode === "edit" ? (
          <Editor
            height="100%"
            defaultLanguage="html"
            value={content}
            onChange={handleChange}
            theme={resolvedTheme === "dark" ? "custom-dark" : "custom-light"}
            beforeMount={(monaco) => {
              const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--main-bg').trim();
              const isDark = resolvedTheme === "dark";
              monaco.editor.defineTheme(isDark ? "custom-dark" : "custom-light", {
                base: isDark ? "vs-dark" : "vs",
                inherit: true,
                rules: [],
                colors: {
                  "editor.background": bgColor || (isDark ? "#0a0a0a" : "#ffffff"),
                },
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              tabSize: 2,
              automaticLayout: true,
            }}
            loading={
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 mr-2" />
                Monaco 加载中...
              </div>
            }
          />
        ) : (
          <iframe
            key={iframeKey}
            title="HTML preview"
            srcDoc={content}
            sandbox="allow-same-origin"
            className="w-full h-full border-0"
          />
        )}
      </div>

      {/* Share dialog */}
      {shareDialogOpen && (
        <ShareHtmlButton
          projectId={projectId}
          filePath={filePath}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </div>
  );
}
