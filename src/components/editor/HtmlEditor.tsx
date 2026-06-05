"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Editor from "@monaco-editor/react";
import ShareHtmlButton from "@/components/project/ShareHtmlButton";

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
  initialValue,
  loaded,
  onSave,
  onContentChange,
}: HtmlEditorProps) {
  const [content, setContent] = useState<string>(initialValue);
  const [mode, setMode] = useState<ViewMode>("edit");
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
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
    setMode("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialValue, filePath]);

  const isDirty = content !== persistedRef.current;

  const handleChange = (next: string | undefined) => {
    if (typeof next !== "string") return;
    setContent(next);
    onContentChange(next);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSave(content);
      persistedRef.current = content;
      setContent((c) => c); // force re-render of dirty flag
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
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center h-[41px] px-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 gap-3 shrink-0">
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

        <div className="flex items-center bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-md overflow-hidden">
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
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`px-3 h-7 text-xs rounded-md transition-colors ${
              isDirty && !saving
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            {saving ? "保存中..." : "保存"}
          </button>
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
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
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
            title="HTML preview"
            srcDoc={content}
            sandbox=""
            className="w-full h-full border-0 bg-white dark:bg-zinc-900"
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
