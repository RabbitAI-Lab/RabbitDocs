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
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {!collapsed && t('newChat')}
    </button>
  );
}
