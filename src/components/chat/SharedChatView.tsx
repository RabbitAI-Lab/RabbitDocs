"use client";

import { Bubble, XProvider } from "@ant-design/x";
import { useTranslations } from "next-intl";
import { Avatar } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import type { BubbleItemType } from "@ant-design/x";

interface SharedMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SharedChatViewProps {
  title: string;
  messages: SharedMessage[];
  brandName: string;
}

const roles = {
  assistant: {
    placement: "start" as const,
    avatar: (
      <Avatar
        icon={<RobotOutlined />}
        style={{ backgroundColor: "#1677ff" }}
      />
    ),
    variant: "borderless" as const,
    typing: { effect: "typing" as const, step: 5, interval: 50 },
  },
  user: {
    placement: "end" as const,
    avatar: <Avatar icon={<UserOutlined />} />,
    variant: "filled" as const,
  },
};

export default function SharedChatView({
  title,
  messages,
  brandName,
}: SharedChatViewProps) {
  const t = useTranslations("chat");
  const bubbleItems: BubbleItemType[] = messages.map((msg) => ({
    key: msg.id.toString(),
    role: msg.role,
    content: msg.content,
    typing:
      msg.role === "assistant"
        ? { effect: "typing" as const, step: 5, interval: 50 }
        : undefined,
  }));

  return (
    <XProvider>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="flex items-center justify-center px-4 h-[41px] bg-white border-b border-gray-200 shrink-0">
          <h1 className="text-sm font-medium text-gray-800 truncate">
            {title}
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <Bubble.List
            style={{ height: "100%", maxWidth: "48rem", margin: "0 auto" }}
            items={bubbleItems}
            role={roles}
            autoScroll
          />
        </div>

        {/* Footer */}
        <div className="max-w-3xl mx-auto w-full px-6 py-4 border-t border-gray-100 bg-white shrink-0">
          <p className="text-xs text-gray-400 text-center">
            {t("sharedView.poweredBy", { brandName })}
          </p>
        </div>
      </div>
    </XProvider>
  );
}
