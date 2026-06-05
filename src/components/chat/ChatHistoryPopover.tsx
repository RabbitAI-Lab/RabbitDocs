"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Conversations } from "@ant-design/x";
import { Button, Spin, Empty, Tooltip } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

interface Chat {
  id: number;
  title: string;
  projectId: string | null;
  workspaceId: string | null;
  updatedAt: string;
}

interface ChatsResponse {
  chats: Chat[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ChatHistoryPopoverProps {
  currentChatId: number | null;
  onSelect: (chatId: number) => void;
}

const PAGE_SIZE = 20;

export default function ChatHistoryPopover({
  currentChatId,
  onSelect,
}: ChatHistoryPopoverProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { authFetch } = useAuth();

  const fetchChats = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await authFetch(`/api/chats?page=${pageNum}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const data: ChatsResponse = await res.json();
        if (append) {
          setChats((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newChats = data.chats.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newChats];
          });
        } else {
          setChats(data.chats || []);
        }
        setHasMore(pageNum < data.totalPages);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchChats(nextPage, true);
  }, [page, fetchChats]);

  useEffect(() => {
    if (open) {
      setPage(1);
      setChats([]);
      fetchChats(1);
    }
  }, [open, fetchChats]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const items = chats.map((chat) => ({
    key: String(chat.id),
    label: chat.title,
  }));

  const handleActiveChange = (key: string) => {
    onSelect(Number(key));
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <Tooltip title={t("header.history")}>
        <Button
          type="text"
          icon={<HistoryOutlined />}
          size="small"
          onClick={() => setOpen((v) => !v)}
        />
      </Tooltip>
      {open && (
        <div
          className="absolute right-0 w-[300px] max-h-[400px] overflow-y-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-md z-50 mt-1"
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Spin />
            </div>
          ) : chats.length === 0 ? (
            <Empty
              description={t("history.noHistory")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <>
              <Conversations
                items={items}
                activeKey={currentChatId != null ? String(currentChatId) : undefined}
                onActiveChange={handleActiveChange}
                menu={(conversation) => ({
                  items: [
                    {
                      key: "delete",
                      label: t("history.delete"),
                      danger: true,
                      onClick: async () => {
                        await authFetch(`/api/chats/${conversation.key}`, {
                          method: "DELETE",
                        });
                        window.dispatchEvent(new Event("chats-changed"));
                        setPage(1);
                        fetchChats(1);
                      },
                    },
                  ],
                })}
              />
              {hasMore && (
                <div className="text-center py-2 border-t border-gray-200 dark:border-zinc-700">
                  <Button type="link" size="small" onClick={loadMore} loading={loadingMore}>
                    {t("history.loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
