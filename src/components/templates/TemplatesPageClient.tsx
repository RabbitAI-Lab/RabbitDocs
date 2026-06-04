"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";

interface Template {
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

interface TemplatesPageClientProps {
  initialTemplates: Template[];
}

export default function TemplatesPageClient({ initialTemplates }: TemplatesPageClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);

  // New Template
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", icon: "" });
  const [creating, setCreating] = useState(false);

  // Copy Template
  const [copyingTemplate, setCopyingTemplate] = useState<Template | null>(null);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);

  const refreshList = async () => {
    setLoading(true);
    const res = await authFetch("/api/templates");
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const newTemplate = await res.json();
      if (newTemplate?.id) {
        router.push(`/templates/${newTemplate.id}`);
      } else {
        refreshList();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!confirm(`确认删除模板 "${name}"?`)) return;
    await authFetch(`/api/templates/${id}`, { method: "DELETE" });
    refreshList();
  };

  const openCopyModal = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    setCopyingTemplate(template);
    setCopyName(template.name + " 副本");
  };

  const handleCopy = async () => {
    if (!copyingTemplate || !copyName.trim() || copying) return;
    setCopying(true);
    try {
      await authFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: copyName.trim(),
          description: copyingTemplate.description,
          content: copyingTemplate.content,
          icon: copyingTemplate.icon,
          agentPrompt: copyingTemplate.agentPrompt,
        }),
      });
      setCopyingTemplate(null);
      refreshList();
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Templates</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Template
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && <Spinner />}

        {/* New Template表单 */}
        {showCreate && (
          <div className="mb-6 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">New Template</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="模板名称"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-400"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
                <input
                  value={createForm.icon}
                  onChange={(e) => setCreateForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="Icon (emoji)"
                  className="w-24 px-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="描述（可选）"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-400"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowCreate(false); setCreateForm({ name: "", description: "", icon: "" }); }}
                  className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {creating ? "创建中..." : "创建并编辑"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 模板列表分组 */}
        {/* 我创建的 */}
        {(() => {
          const userTemplates = templates.filter(t => t.isSystem === 0);
          if (userTemplates.length === 0) return null;
          return (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">我创建的</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userTemplates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/templates/${t.id}`)}
                    className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{t.icon || "📄"}</span>
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{t.name}</h3>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => openCopyModal(e, t)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title="复制"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, t.id, t.name)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {t.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {t.agentPrompt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                            🤖 Agent Prompt 已配置
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                            未配置 Prompt
                          </span>
                        )}
                      </div>
                      {t.content && (
                        <pre className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-700 rounded-lg p-2 max-h-24 overflow-hidden whitespace-pre-wrap line-clamp-3 mt-3">
                          {t.content.slice(0, 150)}{t.content.length > 150 ? "..." : ""}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 系统模板 */}
        {(() => {
          const systemTemplates = templates.filter(t => t.isSystem === 1);
          if (systemTemplates.length === 0) return null;
          return (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">系统模板</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/templates/${t.id}`)}
                    className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{t.icon || "📄"}</span>
                          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{t.name}</h3>
                        </div>
                        {/* 系统模板无删除按钮，但有复制按钮 */}
                        <button
                          onClick={(e) => openCopyModal(e, t)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shrink-0"
                          title="复制"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                      {t.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {t.agentPrompt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                            🤖 Agent Prompt 已配置
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                            未配置 Prompt
                          </span>
                        )}
                      </div>
                      {t.content && (
                        <pre className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-700 rounded-lg p-2 max-h-24 overflow-hidden whitespace-pre-wrap line-clamp-3 mt-3">
                          {t.content.slice(0, 150)}{t.content.length > 150 ? "..." : ""}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {templates.length === 0 && !loading && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No templates, click the button above to create</p>
          </div>
        )}
      </div>

      {/* 复制弹窗 */}
      {copyingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCopyingTemplate(null)}>
          <div
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">复制模板</h3>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">新模板名称</label>
            <input
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCopy(); if (e.key === "Escape") setCopyingTemplate(null); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-400"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setCopyingTemplate(null)}
                className="px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCopy}
                disabled={copying || !copyName.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {copying ? "复制中..." : "确认复制"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
