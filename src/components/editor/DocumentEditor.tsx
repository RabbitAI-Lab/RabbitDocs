"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import EditorToolbar from "./EditorToolbar";
import TitleEditor from "./TitleEditor";

const CherryEditor = dynamic(() => import("./CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-2" />
      加载编辑器中...
    </div>
  ),
});

interface DocumentEditorProps {
  docPath: string;
  pathSegments: string[];
  initialContent: string;
  fileName: string;
}

export default function DocumentEditor({
  docPath,
  pathSegments,
  initialContent,
  fileName,
}: DocumentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(fileName);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async (markdown: string) => {
    setSaving(true);
    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: docPath, content: markdown }),
    });
    setContent(markdown);
    setTimeout(() => setSaving(false), 500);
  }, [docPath]);

  const handleChange = useCallback(
    (markdown: string) => {
      setContent(markdown);
    },
    []
  );

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    await fetch("/api/fs/document", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: docPath, newTitle }),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        docPath={docPath}
        title={title}
        saving={saving}
        onSave={() => handleSave(content)}
        pathSegments={pathSegments}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleEditor title={title} onTitleChange={handleTitleChange} />

        <div className="flex-1 overflow-hidden">
          <CherryEditor
            initialValue={initialContent}
            onChange={handleChange}
            onSave={() => handleSave(content)}
          />
        </div>
      </div>
    </div>
  );
}
