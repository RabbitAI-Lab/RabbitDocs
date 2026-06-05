"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Actions } from "@ant-design/x";
import { Typography } from "antd";
import { SaveOutlined, RedoOutlined, ThunderboltOutlined, DownOutlined } from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import type { BubbleItemType } from "@ant-design/x";
import type { Message } from "./chat-workspace-ref";

/**
 * Extended Thinking 折叠区。默认展开，可折叠。
 * 在 assistant 气泡顶部展示思考过程原文。
 */
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const t = useTranslations("chat");
  if (!text) return null;
  return (
    <div className="mb-2 rounded border border-amber-200 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 dark:text-amber-300 w-full text-left hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
      >
        <ThunderboltOutlined />
        <span className="font-medium">{t("thinkingBlock.thinkingProcess")}</span>
        <span className="text-amber-500 dark:text-amber-400">({text.length} {t("thinkingBlock.charCount")})</span>
        <DownOutlined
          className={`ml-auto transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap border-t border-amber-200/50 dark:border-amber-700/50">
          {text}
        </div>
      )}
    </div>
  );
}

function renderMarkdown(content: string) {
  return (
    <Typography>
      <XMarkdown content={content} />
    </Typography>
  );
}

interface MapMessagesToBubbleItemsOptions {
  messages: Message[];
  loading: boolean;
  onRegenerate: (msg: Message) => void;
  onSaveSingleMessage: (msg: Message) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function mapMessagesToBubbleItems({
  messages,
  loading,
  onRegenerate,
  onSaveSingleMessage,
  t,
}: MapMessagesToBubbleItemsOptions): BubbleItemType[] {
  return messages.map((msg) => {
    const isAiLoading =
      loading &&
      msg.role === "assistant" &&
      !msg.content &&
      msg === messages[messages.length - 1];

    const hasContent = !!msg.content;
    const thinkingText = msg.streamingThinking ?? msg.thinking ?? "";
    const isAssistant = msg.role === "assistant";

    const contentNode = isAssistant ? (
      <div>
        <ThinkingBlock text={thinkingText} />
        {msg.isError ? (
          <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {msg.content}
          </div>
        ) : (
          renderMarkdown(msg.content)
        )}
      </div>
    ) : msg.content;

    return {
      key: msg.id.toString(),
      role: msg.role,
      content: contentNode,
      contentRender: isAssistant ? undefined : renderMarkdown,
      loading: isAiLoading || undefined,
      typing:
        isAssistant && msg.content && !isAiLoading && !msg.isError
          ? { effect: "typing" as const, step: 5, interval: 50 }
          : undefined,
      footer: hasContent
        ? isAssistant
          ? () => (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <Actions
                  items={[
                    {
                      key: "save",
                      label: t("actions.save"),
                      icon: <SaveOutlined />,
                      onItemClick: () => onSaveSingleMessage(msg),
                    },
                    {
                      key: "regenerate",
                      label: t("actions.regenerate"),
                      icon: <RedoOutlined />,
                      onItemClick: () => onRegenerate(msg),
                    },
                  ]}
                />
                <Actions.Copy text={msg.content} />
              </div>
            )
          : () => (
              <Actions.Copy text={msg.content} />
            )
        : undefined,
    };
  });
}
