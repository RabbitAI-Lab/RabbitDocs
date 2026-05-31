"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Chat {
  id: number;
  title: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatsData {
  chats: Chat[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProjectMeta {
  id: string;
  name: string;
}

export default function ChatsPageClient() {
  const router = useRouter();
  const [data, setData] = useState<ChatsData | null>(null);
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    fetch("/api/fs/projects?type=personal&accountId=default")
      .then((res) => res.json())
      .then((projects: ProjectMeta[]) => {
        const map = new Map<string, string>();
        for (const p of projects) map.set(p.id, p.name);
        setProjectMap(map);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/chats?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      });
  }, [page]);

  const handleDelete = async (chatId: number) => {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    fetch(`/api/chats?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((json) => setData(json));
  };

  const handleClearAll = async () => {
    await fetch("/api/chats", { method: "DELETE" });
    setShowClearConfirm(false);
    fetch(`/api/chats?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((json) => setData(json));
    router.refresh();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Chats</h1>
        <span className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {data ? `共 ${data.total} 条会话` : ""}
          </span>
          {data && data.total > 0 && (
            <span className="relative">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                清空
              </button>
              {showClearConfirm && (
                <span className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
                  <span className="text-gray-500">确认清空所有会话?</span>
                  <button
                    onClick={handleClearAll}
                    className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >清空</button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                  >取消</button>
                </span>
              )}
            </span>
          )}
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">加载中...</div>
        </div>
      ) : data && data.chats.length > 0 ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    标题
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
                    所属项目
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                    创建时间
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                    更新时间
                  </th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.chats.map((chat) => (
                  <tr
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-sm text-blue-600 hover:text-blue-800">
                        {chat.title}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {chat.projectId ? (projectMap.get(chat.projectId) || chat.projectId) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {formatDate(chat.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {formatDate(chat.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(confirmDeleteId === chat.id ? null : chat.id); }}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                第 {page} / {data.totalPages} 页
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-2">暂无会话记录</p>
            <button
              onClick={() => router.push("/chat/new")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              开始新会话
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
