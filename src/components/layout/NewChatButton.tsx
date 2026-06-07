"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSidebar } from "./SidebarContext";

export default function NewChatButton() {
  const router = useRouter();
  const { collapsed } = useSidebar();
  const t = useTranslations("sidebar");

  const handleNewChat = () => {
    router.push("/chat/new");
  };

  return (
    <button
      onClick={handleNewChat}
      title={collapsed ? t('newChat') : undefined}
      className="flex items-center justify-center gap-2 w-full text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
      style={{ padding: collapsed ? "6px 0" : "6px 12px" }}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="12" x2="12" y2="18" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      {!collapsed && t('newChat')}
    </button>
  );
}
