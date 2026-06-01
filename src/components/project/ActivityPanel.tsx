"use client";

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
}

interface ActivityPanelProps {
  recentChats: RecentChat[];
  onSwitchToChat: (chatId: number) => void;
  onNewChat: () => void;
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

export default function ActivityPanel({
  recentChats,
  onSwitchToChat,
  onNewChat,
}: ActivityPanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        最近 20 天的会话
      </p>

      {recentChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <svg className="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-sm">暂无对话记录</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recentChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSwitchToChat(chat.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-blue-600 transition-colors">
                {chat.title || "新对话"}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {formatDate(chat.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
