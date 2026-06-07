"use client";

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Message } from "./chat-workspace-ref";

interface UseChatNavigationOptions {
  effectiveChatId: number | null;
  setEffectiveChatId: (id: number | null) => void;
  setEffectiveChatTitle: (title: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInputValue: (value: string) => void;
  selectedProject: string | undefined;
  selectedWorkspace: string | undefined;
  setSelectedModelId: (id: number | string | undefined) => void;
  setSelectedTemplateId: (id: number | undefined) => void;
  setSelectedProject: (id: string | undefined) => void;
  setSelectedWorkspace: (id: string | undefined) => void;
  embedded: boolean;
  floating: boolean;
  router: AppRouterInstance;
  onSwitchToChat?: (chatId: number) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function useChatNavigation({
  effectiveChatId: _effectiveChatId,
  setEffectiveChatId,
  setEffectiveChatTitle,
  setMessages,
  setInputValue,
  selectedProject,
  selectedWorkspace,
  setSelectedModelId,
  setSelectedTemplateId,
  setSelectedProject,
  setSelectedWorkspace,
  embedded,
  floating,
  router,
  onSwitchToChat,
  authFetch,
}: UseChatNavigationOptions) {

  const loadChat = async (targetChatId: number) => {
    try {
      const [chatRes, msgsRes] = await Promise.all([
        authFetch(`/api/chats/${targetChatId}`),
        authFetch(`/api/chats/${targetChatId}/messages`),
      ]);
      if (!chatRes.ok || !msgsRes.ok) return;
      const chat = await chatRes.json();
      const msgs = await msgsRes.json();
      setEffectiveChatId(targetChatId);
      setMessages(
        (msgs || []).map((m: Record<string, unknown>) => ({
          id: m.id as number,
          role: m.role as "user" | "assistant",
          content: m.content as string,
          isError: !!m.isError,
        }))
      );
      if (chat.title) setEffectiveChatTitle(chat.title);
      if (chat.modelId) setSelectedModelId(chat.modelId);
      if (chat.userModelId) setSelectedModelId(`byok_${chat.userModelId}`);
      if (chat.templateId) setSelectedTemplateId(chat.templateId);
      if (chat.projectId) {
        setSelectedProject(chat.projectId);
        setSelectedWorkspace(undefined);
      } else if (chat.workspaceId) {
        setSelectedWorkspace(chat.workspaceId);
        setSelectedProject(undefined);
      }
    } catch {
      // silently fail
    }
  };

  const handleHistorySelect = async (chatId: number) => {
    if (onSwitchToChat) {
      onSwitchToChat(chatId);
      return;
    }

    // Check if the chat is workspace-only, then redirect to workspace page
    try {
      const chatRes = await authFetch(`/api/chats/${chatId}`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();

        // 有 projectId，跳转到项目详情页
        if (chatData.projectId) {
          const projectUrl = `/project/${chatData.projectId}?chatId=${chatId}`;
          if (floating) {
            loadChat(chatId);
          } else if (embedded) {
            window.location.href = projectUrl;
          } else {
            router.push(projectUrl);
          }
          return;
        }

        // 仅 workspaceId，跳转到工作区详情页
        if (chatData.workspaceId) {
          const workspaceUrl = `/workspace/${chatData.workspaceId}?chatId=${chatId}`;
          if (floating) {
            loadChat(chatId);
          } else if (embedded) {
            window.location.href = workspaceUrl;
          } else {
            router.push(workspaceUrl);
          }
          return;
        }
      }
    } catch {
      // fallback to default
    }

    if (floating) {
      loadChat(chatId);
    } else if (embedded) {
      window.location.href = `/chat/${chatId}`;
    } else {
      router.push(`/chat/${chatId}`);
    }
  };

  const handleNewChat = () => {
    if (floating) {
      setEffectiveChatId(null);
      setEffectiveChatTitle("新Chat");
      setMessages([]);
      setInputValue("");
    } else if (selectedProject) {
      router.push(`/project/${selectedProject}?openChat=true`);
    } else if (selectedWorkspace) {
      router.push(`/workspace/${selectedWorkspace}?openChat=true`);
    } else {
      router.push("/chat/new");
    }
  };

  return {
    loadChat,
    handleHistorySelect,
    handleNewChat,
  };
}
