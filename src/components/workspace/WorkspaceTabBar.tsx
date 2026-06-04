"use client";

import type { FileTab } from "./types";
import { WORKSPACE_INFO_TAB, CHAT_TAB } from "./types";

interface WorkspaceTabBarProps {
  /** 当前激活的标签 ID */
  activeTabId: string;
  /** 打开的文件标签列表 */
  tabs: FileTab[];
  /** Workspace ID，用于浮动聊天 */
  workspaceId: string;

  // --- 回调 ---
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string, e?: React.MouseEvent) => void;
  onOpenFloatingChat: (workspaceId: string) => void;
}

export default function WorkspaceTabBar({
  activeTabId,
  tabs,
  workspaceId,
  onTabSelect,
  onTabClose,
  onOpenFloatingChat,
}: WorkspaceTabBarProps) {
  return (
    <div className="flex items-center h-[41px] bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 overflow-x-auto shrink-0">
      {/* Workspace Info tab (fixed, first) */}
      <button
        onClick={() => onTabSelect(WORKSPACE_INFO_TAB)}
        className={`flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
          activeTabId === WORKSPACE_INFO_TAB
            ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
            : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        Workspace Info
      </button>

      {/* Chat tab */}
      <button
        onClick={() => onTabSelect(CHAT_TAB)}
        className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
          activeTabId === CHAT_TAB
            ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
            : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Chat
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onOpenFloatingChat(workspaceId); }}
          className="ml-0.5 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-blue-500 transition-opacity"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <path d="M21 3l-7 7" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </span>
      </button>

      {/* File tabs */}
      {tabs.map((tab) => {
        const fileName = tab.filePath.split("/").pop() || tab.filePath;
        return (
          <button
            key={tab.filePath}
            onClick={() => onTabSelect(tab.filePath)}
            className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTabId === tab.filePath
                ? "bg-white text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.type === "html" ? (
              <svg
                className="w-3.5 h-3.5 shrink-0 text-orange-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="HTML tab"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="9 13 7 15 9 17" />
                <polyline points="15 13 17 15 15 17" />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-label="Markdown tab"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
            <span className="truncate max-w-[120px]">{fileName}</span>
            <span
              role="button"
              onClick={(e) => onTabClose(tab.filePath, e)}
              className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
