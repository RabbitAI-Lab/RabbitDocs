"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import type { DocumentActivity } from "@/lib/types";

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
}

interface ActivityPanelProps {
  recentChats: RecentChat[];
  recentDocuments: DocumentActivity[];
  onSwitchToChat: (chatId: number) => void;
  onNewChat: () => void;
  onNavigateToDocument?: (documentPath: string) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_CONFIG: Record<string, { labelKey: string; color: string; icon: ReactElement }> = {
  create: {
    labelKey: "activity.actionAdded",
    color: "text-green-500",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  update: {
    labelKey: "activity.actionModified",
    color: "text-blue-500",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  delete: {
    labelKey: "activity.actionDeleted",
    color: "text-red-400",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  rename: {
    labelKey: "activity.actionRenamed",
    color: "text-amber-500",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
  },
};

export default function ActivityPanel({
  recentChats,
  recentDocuments,
  onSwitchToChat,
  onNewChat,
  onNavigateToDocument,
}: ActivityPanelProps) {
  const t = useTranslations('project');
  return (
    <div className="space-y-6">
      {/* Section 1: Recent Chats */}
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-300">
          {t('activity.recentChats')}
        </p>

        {recentChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">{t('activity.noChatHistory')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSwitchToChat(chat.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors text-left group"
              >
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {chat.title || t('activity.newChat')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {formatDate(chat.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <hr className="border-gray-100 dark:border-zinc-700" />

      {/* Section 2: Recent Document Activities */}
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-300">
          {t('activity.recentDocuments')}
        </p>

        {recentDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm">{t('activity.noDocumentChanges')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentDocuments.map((doc) => {
              const config = ACTION_CONFIG[doc.action] || ACTION_CONFIG.update;
              const isDeleted = doc.action === "delete";

              const content = (
                <>
                  <span className={`shrink-0 ${config.color}`}>
                    {config.icon}
                  </span>
                  <span className={`flex-1 text-sm truncate ${isDeleted ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400"} transition-colors`}>
                    {doc.documentTitle}
                  </span>
                  <span className={`text-xs shrink-0 ${config.color}`}>
                    {t(config.labelKey)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {formatDate(doc.createdAt)}
                  </span>
                </>
              );

              if (isDeleted) {
                return (
                  <div
                    key={doc.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-60"
                    title={t('activity.actionDeleted')}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={doc.id}
                  onClick={() => onNavigateToDocument?.(doc.documentPath)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors text-left group"
                >
                  {content}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
