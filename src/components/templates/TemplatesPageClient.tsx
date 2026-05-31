"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";

interface Template {
  id: number;
  name: string;
  description: string | null;
  content: string;
  icon: string | null;
  agentPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplatesPageClientProps {
  initialTemplates: Template[];
}

export default function TemplatesPageClient({ initialTemplates }: TemplatesPageClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [loading, setLoading] = useState(false);

  // 新建模板
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", icon: "" });
  const [creating, setCreating] = useState(false);

  const refreshList = async () => {
    setLoading(true);
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
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
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    refreshList();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Templates</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建模板
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && <Spinner />}

        {/* 新建模板表单 */}
        {showCreate && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">新建模板</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="模板名称"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
                <input
                  value={createForm.icon}
                  onChange={(e) => setCreateForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="Icon (emoji)"
                  className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="描述（可选）"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowCreate(false); setCreateForm({ name: "", description: "", icon: "" }); }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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

        {/* 模板列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => router.push(`/templates/${t.id}`)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{t.icon || "📄"}</span>
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{t.name}</h3>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, t.id, t.name)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    title="删除"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                {t.description && (
                  <p className="text-xs text-gray-500 mb-3">{t.description}</p>
                )}
                <div className="flex items-center gap-2">
                  {t.agentPrompt ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      🤖 Agent Prompt 已配置
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      未配置 Prompt
                    </span>
                  )}
                </div>
                {t.content && (
                  <pre className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 max-h-24 overflow-hidden whitespace-pre-wrap line-clamp-3 mt-3">
                    {t.content.slice(0, 150)}{t.content.length > 150 ? "..." : ""}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && !loading && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm text-gray-500">暂无模板，点击上方按钮创建</p>
          </div>
        )}
      </div>
    </div>
  );
}
