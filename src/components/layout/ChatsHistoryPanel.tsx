"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import CollapsibleGroup from "@/components/ui/CollapsibleGroup";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "@/components/auth/useAuth";

interface Chat {
  id: number;
  title: string;
  updatedAt: string;
  projectId?: string | null;
  workspaceId?: string | null;
}

interface ChatsHistoryPanelProps {
  chats: Chat[];
  panelCollapsed?: boolean;
  onTogglePanelCollapse?: (collapsed: boolean) => void;
}

interface ChatGroup {
  label: string;
  chats: Chat[];
}

function getGroupKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatGroupLabel(key: string, t: (key: string) => string): string {
  const d = new Date(key + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('yesterday');
  if (diffDays === 2) return t('twoDaysAgo');
  // Within this year, show "M/D"
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  // Other years
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function groupChats(chats: Chat[], t: (key: string) => string): ChatGroup[] {
  if (chats.length === 0) return [];

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);

  const recentChats: Chat[] = [];
  const olderMap = new Map<string, Chat[]>();

  for (const chat of chats) {
    const d = new Date(chat.updatedAt);
    if (d >= oneWeekAgo) {
      recentChats.push(chat);
    } else {
      const key = getGroupKey(chat.updatedAt);
      if (!olderMap.has(key)) {
        olderMap.set(key, []);
      }
      olderMap.get(key)!.push(chat);
    }
  }

  const groups: ChatGroup[] = [];

  // First group: recent 7 days
  if (recentChats.length > 0) {
    groups.push({ label: t('last7Days'), chats: recentChats });
  }

  // Then by date descending
  const sortedKeys = [...olderMap.keys()].sort((a, b) => b.localeCompare(a));
  for (const key of sortedKeys) {
    groups.push({ label: formatGroupLabel(key, t), chats: olderMap.get(key)! });
  }

  return groups;
}

export default function ChatsHistoryPanel({ chats, panelCollapsed, onTogglePanelCollapse }: ChatsHistoryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const t = useTranslations("chatsHistory");
  const groups = groupChats(chats, t);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { user, authFetch } = useAuth();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  const handleDelete = async (chatId: number) => {
    await authFetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    window.dispatchEvent(new Event("chats-changed"));
    if (pathname === `/chat/${chatId}`) {
      router.push("/chat/new");
    }
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2">
        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    );
  }

  return (
    <CollapsibleGroup title={t('title')} open={panelCollapsed !== undefined ? !panelCollapsed : undefined} onToggle={onTogglePanelCollapse ? (open) => onTogglePanelCollapse(!open) : undefined} storageKey={panelCollapsed === undefined ? "chats-history-collapsed" : undefined}>
      <div className="space-y-1">
        {groups.length === 0 && (
          <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 text-center">{t('noChatHistory')}</p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 py-1 text-xs font-medium text-gray-400 dark:text-gray-500">
              {group.label}
            </div>
            <div className="space-y-[1.5px] px-2">
              {group.chats.map((chat) => {
                const chatPath = `/chat/${chat.id}`;
                const isActive = pathname === chatPath;
                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      // workspace-only 的 chat 跳转到 workspace 详情页
                      if (chat.workspaceId && !chat.projectId) {
                        router.push(`/workspace/personal/${user?.id ?? ''}/${chat.workspaceId}?chatId=${chat.id}`);
                      } else {
                        router.push(chatPath);
                      }
                    }}
                    className={cn(
                      "group relative flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-lg transition-colors text-left cursor-pointer",
                      isActive
                        ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    )}
                  >
                    <span className="truncate">{chat.title}</span>
                    <span className="flex items-center shrink-0 ml-2">
                      <span className="text-xs text-gray-300 dark:text-gray-600 group-hover:opacity-0 transition-opacity">
                        {formatTime(chat.updatedAt)}
                      </span>
                      <span className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(confirmDeleteId === chat.id ? null : chat.id); }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-red-400 hover:text-red-600"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                        {confirmDeleteId === chat.id && (
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50"
                          >
                            <span className="text-gray-500 dark:text-gray-400">{t('confirmDelete')}</span>
                            <button
                              onClick={() => handleDelete(chat.id)}
                              className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >{t('delete')}</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >{t('cancel')}</button>
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleGroup>
  );
}
