"use client";

import React from "react";
import { Button, Space, Tooltip, Popover, Input } from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ShareAltOutlined,
  CopyOutlined,
  ReloadOutlined,
  StopOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import ChatHistoryPopover from "./ChatHistoryPopover";

interface ChatHeaderProps {
  effectiveChatTitle: string;
  effectiveChatId: number | null;
  embedded: boolean;
  onBack?: () => void;
  onNewChat: () => void;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  shareToken: string | null;
  shareLoading: boolean;
  onShare: () => void;
  onCopyLink: () => void;
  onRegenerateLink: () => void;
  onCancelShare: () => void;
  onHistorySelect: (chatId: number) => void;
  onClear: () => void;
}

export default function ChatHeader({
  effectiveChatTitle,
  effectiveChatId,
  embedded,
  onBack,
  onNewChat,
  shareOpen,
  setShareOpen,
  shareToken,
  shareLoading,
  onShare,
  onCopyLink,
  onRegenerateLink,
  onCancelShare,
  onHistorySelect,
  onClear,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 h-[41px] bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 min-w-0">
        {embedded && onBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            size="small"
            onClick={onBack}
          />
        )}
        <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {effectiveChatTitle}
        </h2>
      </div>
      <Space size="small">
        <Tooltip title="新会话">
          <Button
            type="text"
            icon={<PlusOutlined />}
            size="small"
            onClick={onNewChat}
          />
        </Tooltip>
        {effectiveChatId && (
          <Popover
            open={shareOpen}
            onOpenChange={setShareOpen}
            trigger="click"
            placement="bottomRight"
            title="Share Chat"
            content={
              <div style={{ width: 280 }}>
                <Input.TextArea
                  readOnly
                  value={shareToken ? `${window.location.origin}/share/${shareToken}` : ""}
                  autoSize={{ minRows: 2, maxRows: 3 }}
                  style={{ fontSize: 12, marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Button
                    icon={<CopyOutlined />}
                    size="small"
                    onClick={onCopyLink}
                    block
                  >
                    复制链接
                  </Button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    danger
                    loading={shareLoading}
                    onClick={onRegenerateLink}
                    block
                  >
                    重新生成
                  </Button>
                  <Button
                    icon={<StopOutlined />}
                    size="small"
                    danger
                    loading={shareLoading}
                    onClick={onCancelShare}
                    block
                  >
                    取消分享
                  </Button>
                </div>
              </div>
            }
          >
            <Tooltip title="分享">
              <Button
                type="text"
                icon={<ShareAltOutlined />}
                size="small"
                loading={shareLoading}
                onClick={onShare}
              />
            </Tooltip>
          </Popover>
        )}
        <ChatHistoryPopover
          currentChatId={effectiveChatId}
          onSelect={onHistorySelect}
        />
        <Tooltip title="Clear">
          <Button
            type="text"
            icon={<ClearOutlined />}
            size="small"
            onClick={onClear}
          />
        </Tooltip>
      </Space>
    </div>
  );
}
