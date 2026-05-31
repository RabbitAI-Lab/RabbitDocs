"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import CollapsibleGroup from "@/components/ui/CollapsibleGroup";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

interface Chat {
  id: number;
  title: string;
  updatedAt: string;
}

interface ChatsHistoryPanelProps {
  chats: Chat[];
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

function formatGroupLabel(key: string): string {
  const d = new Date(key + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays === 2) return "前天";
  // Within this year, show "M月D日"
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  // Other years
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function groupChats(chats: Chat[]): ChatGroup[] {
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
    groups.push({ label: "近一周", chats: recentChats });
  }

  // Then by date descending
  const sortedKeys = [...olderMap.keys()].sort((a, b) => b.localeCompare(a));
  for (const key of sortedKeys) {
    groups.push({ label: formatGroupLabel(key), chats: olderMap.get(key)! });
  }

  return groups;
}

export default function ChatsHistoryPanel({ chats }: ChatsHistoryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const groups = groupChats(chats);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  const handleDelete = async (chatId: number) => {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    if (pathname === `/chat/${chatId}`) {
      router.push("/chat/new");
    }
    router.refresh();
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
    <CollapsibleGroup title="Chats History" defaultOpen={true}>
      <div className="space-y-1">
        {groups.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-400">暂无聊天记录</p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.chats.map((chat) => {
                const chatPath = `/chat/${chat.id}`;
                const isActive = pathname === chatPath;
                return (
                  <div
                    key={chat.id}
                    onClick={() => router.push(chatPath)}
                    className={cn(
                      "group relative flex items-center justify-between w-full px-3 py-1.5 text-sm rounded-lg transition-colors text-left cursor-pointer",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-blue-600 hover:bg-blue-50"
                    )}
                  >
                    <span className="truncate">{chat.title}</span>
                    <span className="flex items-center shrink-0 ml-2">
                      <span className="text-xs text-gray-400 group-hover:opacity-0 transition-opacity">
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
                            className="absolute right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50"
                          >
                            <span className="text-gray-500">确认删除?</span>
                            <button
                              onClick={() => handleDelete(chat.id)}
                              className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >删除</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                            >取消</button>
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
