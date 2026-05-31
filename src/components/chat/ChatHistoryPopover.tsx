"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Conversations } from "@ant-design/x";
import { Button, Spin, Empty, Tooltip } from "antd";
import { HistoryOutlined } from "@ant-design/icons";

interface Chat {
  id: number;
  title: string;
  projectId: string | null;
  updatedAt: string;
}

interface ChatHistoryPopoverProps {
  currentChatId: number | null;
  onSelect: (chatId: number) => void;
}

export default function ChatHistoryPopover({
  currentChatId,
  onSelect,
}: ChatHistoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chats?pageSize=50");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchChats();
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
      <Tooltip title="History">
        <Button
          icon={<HistoryOutlined />}
          size="small"
          onClick={() => setOpen((v) => !v)}
        />
      </Tooltip>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            width: 300,
            maxHeight: 400,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            zIndex: 50,
            marginTop: 4,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Spin />
            </div>
          ) : chats.length === 0 ? (
            <Empty
              description="暂无聊天记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Conversations
              items={items}
              activeKey={currentChatId != null ? String(currentChatId) : undefined}
              onActiveChange={handleActiveChange}
              menu={(conversation) => ({
                items: [
                  {
                    key: "delete",
                    label: "删除",
                    danger: true,
                    onClick: async () => {
                      await fetch(`/api/chats/${conversation.key}`, {
                        method: "DELETE",
                      });
                      fetchChats();
                    },
                  },
                ],
              })}
            />
          )}
        </div>
      )}
    </div>
  );
}
