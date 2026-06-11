"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Space, Tooltip, Popover, Input } from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ShareAltOutlined,
  CopyOutlined,
  ReloadOutlined,
  StopOutlined,
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
}: ChatHeaderProps) {
  const t = useTranslations("chat");
  return (
    <div className={`flex items-center justify-between px-3 shrink-0 overflow-hidden ${embedded ? 'h-[38px]' : 'h-[41px]'} border-b border-gray-200 dark:border-zinc-700`}>
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
        <Tooltip title={t("header.newChat")}>
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
            title={t("header.shareChat")}
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
                    {t("header.copyLink")}
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
                    {t("header.regenerateLink")}
                  </Button>
                  <Button
                    icon={<StopOutlined />}
                    size="small"
                    danger
                    loading={shareLoading}
                    onClick={onCancelShare}
                    block
                  >
                    {t("header.cancelShare")}
                  </Button>
                </div>
              </div>
            }
          >
            <Tooltip title={t("header.share")}>
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
      </Space>
    </div>
  );
}
