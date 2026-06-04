"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/useAuth";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
      编辑器加载中...
    </div>
  ),
});

interface TemplateData {
  id: number;
  name: string;
  description: string | null;
  content: string;
  icon: string | null;
  agentPrompt: string | null;
  isSystem: number;  // 0=用户创建, 1=系统模板
  createdAt: string;
  updatedAt: string;
}

interface TemplateEditorProps {
  template: TemplateData;
}

const promptToolbar = [
  "bold", "italic", "|",
  "header", "list", "|",
  "code", "|",
  "undo", "redo",
];

export default function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter();
  const isSystem = template.isSystem === 1;  // 系统模板只读
  const [name, setName] = useState(template.name);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(template.name);
  const [content, setContent] = useState(template.content || "");
  const [agentPrompt, setAgentPrompt] = useState(template.agentPrompt || "");
  const [activeTab, setActiveTab] = useState<"content" | "prompt">("content");
  const [saving, setSaving] = useState(false);
  const { authFetch } = useAuth();

  const tabItems: { key: "content" | "prompt"; label: string; icon: string }[] = [
    { key: "content", label: "模版内容", icon: "📄" },
    { key: "prompt", label: "Agent Prompt", icon: "🤖" },
  ];

  const saveTemplate = useCallback(
    async (fields: Partial<{ name: string; content: string; agentPrompt: string }>) => {
      setSaving(true);
      await authFetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      setSaving(false);
    },
    [template.id, authFetch]
  );

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
  }, []);

  const handlePromptChange = useCallback((text: string) => {
    setAgentPrompt(text);
  }, []);

  const handleContentSave = useCallback(() => {
    saveTemplate({ content, agentPrompt });
  }, [content, agentPrompt, saveTemplate]);

  const handlePromptSave = useCallback(() => {
    saveTemplate({ content, agentPrompt });
  }, [content, agentPrompt, saveTemplate]);

  const handleNameSubmit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== name) {
      setName(trimmed);
      saveTemplate({ name: trimmed });
    } else {
      setNameInput(name);
    }
    setEditingName(false);
  };

  const handleDelete = async () => {
    if (!confirm(`确认删除模板 "${name}"?`)) return;
    await authFetch(`/api/templates/${template.id}`, { method: "DELETE" });
    router.push("/templates");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/templates")}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回列表
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-zinc-700" />
          {editingName && !isSystem ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setNameInput(name);
                  setEditingName(false);
                }
              }}
              onBlur={handleNameSubmit}
              className="text-sm font-semibold text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none min-w-0"
            />
          ) : (
            <span
              className={`text-sm font-semibold text-gray-800 dark:text-gray-100 truncate ${!isSystem ? "hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" : ""}`}
              onClick={() => {
                if (!isSystem) {
                  setNameInput(name);
                  setEditingName(true);
                }
              }}
            >
              {template.icon && <span className="mr-1">{template.icon}</span>}
              {name}
              {!isSystem && (
                <svg
                  className="inline-block w-3 h-3 ml-1.5 text-gray-300 dark:text-zinc-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isSystem ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-700 rounded-lg">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              只读模式
            </span>
          ) : (
            <>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {saving ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    保存中...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                    已保存
                  </span>
                )}
              </span>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs + Editor */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center gap-0 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-zinc-500"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          {activeTab === "prompt" && (
            <span className="ml-auto pr-4 text-[10px] text-gray-400 dark:text-gray-500">Injected into chat context as System Prompt</span>
          )}
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "content" && (
            <CherryEditor
              editorId="template-content-editor"
              initialValue={content}
              onChange={isSystem ? undefined : handleContentChange}
              onSave={isSystem ? undefined : handleContentSave}
              defaultModel={isSystem ? "previewOnly" : "editOnly"}
            />
          )}
          {activeTab === "prompt" && (
            <CherryEditor
              editorId="template-prompt-editor"
              initialValue={agentPrompt}
              onChange={isSystem ? undefined : handlePromptChange}
              onSave={isSystem ? undefined : handlePromptSave}
              defaultModel={isSystem ? "previewOnly" : "editOnly"}
              toolbarItems={isSystem ? undefined : promptToolbar}
            />
          )}
        </div>
      </div>
    </div>
  );
}
