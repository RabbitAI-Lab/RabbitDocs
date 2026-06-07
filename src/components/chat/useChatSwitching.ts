"use client";

import { useState, useCallback, useRef } from "react";
import type { RecentChat } from "@/lib/types";
import { getChatUrl } from "@/lib/chat-navigation";

export type { RecentChat };

const CHAT_TAB = "__chat__" as const;

export interface UseChatSwitchingInit {
  chatId: number;
  chatTitle: string;
  initialMessages: Array<{ id: number; role: "user" | "assistant"; content: string }>;
  initialModelId?: number;
  initialTemplateId?: number;
}

interface UseChatSwitchingOptions {
  setActiveTabId: (id: string) => void;
  projectId?: string;
  router?: { push: (url: string) => void };
  onNewChatNavigate?: () => void;
  userId?: string;
  embedded?: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function useChatSwitching({ setActiveTabId, projectId, router, onNewChatNavigate, userId, embedded, authFetch }: UseChatSwitchingOptions) {
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatTitle, setActiveChatTitle] = useState("New Conversation");
  const [activeChatMessages, setActiveChatMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string }>>([]);
  const [activeChatModelId, setActiveChatModelId] = useState<number | undefined>();
  const [activeChatTemplateId, setActiveChatTemplateId] = useState<number | undefined>();
  const [chatKey, setChatKey] = useState(0);

  const initRef = useRef(false);

  const init = useCallback((options: UseChatSwitchingInit) => {
    if (initRef.current) return;
    initRef.current = true;
    setActiveChatId(options.chatId);
    setActiveChatTitle(options.chatTitle);
    setActiveChatMessages(options.initialMessages);
    setActiveChatModelId(options.initialModelId);
    setActiveChatTemplateId(options.initialTemplateId);
    setChatKey((k) => k + 1);
  }, []);

  const handleSwitchToChat = useCallback(async (targetChatId: number) => {
    try {
      // Fetch chat metadata to check project association
      const chatRes = await authFetch(`/api/chats/${targetChatId}`);
      const chatData = await chatRes.json();
      const targetProjectId = chatData.projectId || undefined;

      // If the target chat belongs to a different project, do a full page navigation
      if (targetProjectId !== projectId) {
        const chatUrl = getChatUrl({ chatId: targetChatId, projectId: chatData.projectId, workspaceId: chatData.workspaceId, userId: userId ?? '' });
        router?.push(chatUrl || `/chat/${targetChatId}`);
        return;
      }

      // Same project (or both no project) — fast client-side switch
      const msgRes = await authFetch(`/api/chats/${targetChatId}/messages`);
      const msgData = await msgRes.json();

      setActiveChatId(targetChatId);
      setActiveChatTitle(chatData.title || "New Conversation");
      setActiveChatMessages(
        (Array.isArray(msgData) ? msgData : msgData.messages || []).map(
          (m: Record<string, unknown>) => ({
            id: m.id as number,
            role: m.role as "user" | "assistant",
            content: m.content as string,
            isError: !!m.isError,
          })
        )
      );
      setActiveChatModelId(chatData.modelId);
      setActiveChatTemplateId(chatData.templateId);
      setChatKey((k) => k + 1);
      setActiveTabId(CHAT_TAB);
      // 嵌入模式下更新 ?chatId 查询参数
      if (embedded && projectId) {
        window.history.replaceState(null, '', `?chatId=${targetChatId}`);
      } else {
        window.history.replaceState(null, '', `/chat/${targetChatId}`);
      }
    } catch {
      // Fallback to full page navigation on error
      const chatUrl = getChatUrl({ chatId: targetChatId, userId: userId ?? '' });
      router?.push(chatUrl || `/chat/${targetChatId}`);
    }
  }, [setActiveTabId, projectId, router, embedded, userId, authFetch]);

  const handleNewChat = useCallback(() => {
    if (onNewChatNavigate) {
      onNewChatNavigate();
      return;
    }
    // Fallback: client-side reset
    setActiveChatId(null);
    setActiveChatTitle("New Conversation");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setChatKey((k) => k + 1);
    setActiveTabId(CHAT_TAB);
  }, [setActiveTabId, onNewChatNavigate]);

  const reset = useCallback(() => {
    setActiveChatId(null);
    setActiveChatTitle("New Conversation");
    setActiveChatMessages([]);
    setActiveChatModelId(undefined);
    setActiveChatTemplateId(undefined);
    setChatKey((k) => k + 1);
  }, []);

  return {
    activeChatId,
    setActiveChatId,
    activeChatTitle,
    setActiveChatTitle,
    activeChatMessages,
    setActiveChatMessages,
    activeChatModelId,
    setActiveChatModelId,
    activeChatTemplateId,
    setActiveChatTemplateId,
    chatKey,
    setChatKey,
    handleSwitchToChat,
    handleNewChat,
    init,
    reset,
  };
}
