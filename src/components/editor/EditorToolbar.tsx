"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";

interface EditorToolbarProps {
  docPath: string;
  title: string;
  saving: boolean;
  onSave: () => void;
  pathSegments: string[];
}

export default function EditorToolbar({
  docPath,
  title,
  saving,
  onSave,
  pathSegments,
}: EditorToolbarProps) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const t = useTranslations('common');

  const handleDelete = async () => {
    if (!confirm(t('confirmDeleteDoc', { title }))) return;
    await authFetch("/api/fs/document", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: docPath }),
    });
    // 尝试跳转回当前项目的 Chat tab
    const projectId = pathSegments[1]; // pathSegments = ["projects", "{projectId}", "docs", ...]
    if (projectId) {
      router.push(`/project/${projectId}?openChat=true`);
    } else {
      router.push("/chat/new");
    }
  };

  const handlePublish = async () => {
    await authFetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: docPath, content: "__PUBLISH__" }),
    });
    const pubPath = pathSegments.join("/");
    window.open(`/publish/${pubPath}`, "_blank");
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
              {t('saving')}
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {t('save')}
            </>
          )}
        </button>

        <button
          onClick={handlePublish}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          {t('publish')}
        </button>
      </div>

      <button
        onClick={handleDelete}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {t('delete')}
      </button>
    </div>
  );
}
