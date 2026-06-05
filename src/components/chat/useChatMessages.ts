"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Message } from "./chat-workspace-ref";
import type { TemplateItem } from "./useChatSelectors";
import { buildSystemMessage, consumeSseStream } from "./chat-constants";

/**
 * SSE 事件回调中更新消息的辅助函数。
 */
function updateMessageById(
  prev: Message[],
  id: number,
  patch: Partial<Message>
): Message[] {
  return prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

/**
 * 统一的 AI 流式响应处理。
 * 提取自 handleSend / handleRegenerate 的重复 SSE 解析逻辑。
 */
async function streamAiResponse(params: {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  tempAiMsgId: number;
  chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  selectedModelId: number;
  selectedProject: string | undefined;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): Promise<{ aiContent: string; aiThinking: string; aiSignature: string | undefined; hasError: boolean }> {
  const {
    authFetch,
    tempAiMsgId,
    chatMessages,
    setMessages,
    abortControllerRef,
    selectedModelId,
    selectedProject,
    onToolCall,
    t,
  } = params;

  let aiContent = "";
  let aiThinking = "";
  let aiSignature: string | undefined;
  let hasError = false;

  try {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const res = await authFetch("/api/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: selectedModelId,
        messages: chatMessages,
        projectId: selectedProject,
      }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: t('errors.requestFailed') }));
      aiContent = errData.error || t('errors.modelCallFailed');
      setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent }));
    } else {
      const reader = res.body?.getReader();
      if (reader) {
        await consumeSseStream(reader, (eventType, data) => {
          if (eventType === "delta" && data.type === "text_delta" && typeof data.text === "string") {
            aiContent += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent }));
          } else if (eventType === "thinking_start" && data.type === "thinking_start") {
            aiThinking = "";
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: "" }));
          } else if (eventType === "thinking_delta" && data.type === "thinking_delta" && typeof data.text === "string") {
            aiThinking += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: aiThinking }));
          } else if (eventType === "thinking_signature" && data.type === "thinking_signature" && typeof data.signature === "string") {
            aiSignature = data.signature;
          } else if (eventType === "error") {
            aiContent = (data.error as string) || t('errors.modelCallError');
            hasError = true;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
          } else if (eventType === "done" && data.type === "done") {
            if (!aiContent && typeof data.fullText === "string") {
              aiContent = data.fullText;
            }
            const finalThinking = (data.thinking as string | undefined) || (aiThinking || undefined);
            const finalSignature = (data.thinkingSignature as string | undefined) || aiSignature;
            setMessages((prev) =>
              updateMessageById(prev, tempAiMsgId, {
                content: aiContent,
                thinking: finalThinking,
                thinkingSignature: finalSignature,
                streamingThinking: undefined,
              })
            );
          } else if (eventType === "tool_call" && data.type === "tool_call") {
            console.log("[ChatWorkspace] tool_call:", data.toolName, data.args);
            onToolCall?.({
              toolName: data.toolName as string,
              args: (data.args as Record<string, unknown>) ?? {},
            });
          }
        });
      } else {
        aiContent = t('errors.cannotReadStream');
        hasError = true;
        setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      aiContent = aiContent || t('errors.modelCallFailedRetry');
      hasError = true;
      setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
    }
  } finally {
    abortControllerRef.current = null;
  }

  return { aiContent, aiThinking, aiSignature, hasError };
}

interface UseChatMessagesOptions {
  effectiveChatId: number | null;
  setEffectiveChatId: (id: number | null) => void;
  initialMessages: Message[];
  selectedModelId: number | undefined;
  selectedProject: string | undefined;
  selectedWorkspace: string | undefined;
  workspaceId: string | undefined;
  selectedTemplateId: number | undefined;
  templates: TemplateItem[];
  projectName?: string;
  openFileTabs?: Array<{ fileName: string; filePath: string }>;
  embedded: boolean;
  floating: boolean;
  router: AppRouterInstance;
  onChatCreated?: (chatId: number) => void;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  mentionFile?: string | null;
  onMentionConsumed?: () => void;
}

export function useChatMessages({
  effectiveChatId,
  setEffectiveChatId,
  initialMessages,
  selectedModelId,
  selectedProject,
  selectedWorkspace,
  workspaceId,
  selectedTemplateId,
  templates,
  projectName,
  openFileTabs,
  embedded,
  floating,
  router,
  onChatCreated,
  onToolCall,
  mentionFile,
  onMentionConsumed,
}: UseChatMessagesOptions) {
  const creatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const { authFetch } = useAuth();
  const t = useTranslations("chat");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [mentionedFiles, setMentionedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (mentionFile) {
      setMentionedFiles((prev) => {
        if (prev.includes(mentionFile)) return prev;
        return [...prev, mentionFile];
      });
      onMentionConsumed?.();
    }
  }, [mentionFile, onMentionConsumed]);

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    if (!selectedModelId) {
      setInputValue(content);
      return;
    }

    console.log("Selected model:", selectedModelId, "Selected project:", selectedProject, "Selected template:", selectedTemplateId);
    setLoading(true);
    const trimmed = content.trim();
    setInputValue("");

    // Prepend mentioned files to message content
    let fullContent = trimmed;
    if (mentionedFiles.length > 0) {
      const mentionText = mentionedFiles
        .map((f) => {
          const fileName = f.split("/").pop() || f;
          return `@${fileName}`;
        })
        .join(" ");
      fullContent = `${mentionText} ${trimmed}`;
    }
    setMentionedFiles([]);

    // 1. Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content: fullContent,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. If no chat exists yet, create one first
    let currentChatId = effectiveChatId;
    if (currentChatId === null) {
      if (creatingRef.current) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setLoading(false);
        return;
      }
      creatingRef.current = true;
      try {
        const chatRes = await authFetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed.slice(0, 50),
            modelId: selectedModelId,
            templateId: selectedTemplateId,
            projectId: selectedProject,
            workspaceId: selectedWorkspace ?? workspaceId,
          }),
        });
        if (!chatRes.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
          setLoading(false);
          creatingRef.current = false;
          return;
        }
        const chat = await chatRes.json();
        currentChatId = chat.id;
        setEffectiveChatId(chat.id);
        onChatCreated?.(chat.id);
        router.refresh();
        if (!embedded && !floating) {
          window.history.replaceState(null, "", `/chat/${chat.id}`);
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setLoading(false);
        creatingRef.current = false;
        return;
      }
      creatingRef.current = false;
    }

    // 3. Save user message to DB
    try {
      const userRes = await authFetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: trimmed }),
      });

      if (userRes.ok) {
        const saved = await userRes.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserMsg.id ? { ...m, id: saved.id } : m))
        );
      } else {
        console.error("[ChatWorkspace] Failed to save user message:", userRes.status, await userRes.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[ChatWorkspace] Error saving user message:", err);
    }

    // 4. Add AI placeholder message (loading bubble)
    const tempAiMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      streamingThinking: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    // 5. Stream AI response via SSE
    const selectedTemplate = selectedTemplateId
      ? templates.find((t) => t.id === selectedTemplateId)
      : undefined;

    const systemMsg = buildSystemMessage({
      agentPrompt: selectedTemplate?.agentPrompt,
      templateContent: selectedTemplate?.content,
      projectId: selectedProject,
      projectName,
      openFileTabs,
    });

    const allMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...(systemMsg ? [systemMsg] : []),
      ...messages.filter((m) => !m.isError).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: fullContent },
    ];

    const result = await streamAiResponse({
      authFetch,
      tempAiMsgId: tempAiMsg.id,
      chatMessages: allMessages,
      setMessages,
      abortControllerRef,
      selectedModelId,
      selectedProject,
      onToolCall,
      t,
    });

    // 6. Save AI message to DB（带 Extended Thinking 字段）
    if (result.aiContent) {
      // Use a ref-based approach to read latest thinking/signature from setMessages
      const finalThinking = result.aiThinking || null;
      const finalSignature = result.aiSignature ?? null;
      // 检查当前消息是否被标记为 isError
      const isErrorMessage = result.hasError;
      const aiRes = await authFetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: result.aiContent,
          thinking: finalThinking,
          thinkingSignature: finalSignature,
          isError: isErrorMessage,
        }),
      });

      if (aiRes.ok) {
        const savedAi = await aiRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiMsg.id
              ? {
                  ...m,
                  id: savedAi.id,
                  content: result.aiContent,
                  thinking: savedAi.thinking ?? finalThinking,
                  thinkingSignature: savedAi.thinkingSignature ?? finalSignature,
                  streamingThinking: undefined,
                }
              : m
          )
        );
      }
    }

    setLoading(false);
  }, [loading, selectedModelId, selectedProject, selectedTemplateId, selectedWorkspace, workspaceId, effectiveChatId, embedded, floating, mentionedFiles, messages, templates, projectName, openFileTabs, router, onChatCreated, onToolCall, setEffectiveChatId]);

  const handleRegenerate = useCallback(async (aiMsg: Message) => {
    if (!effectiveChatId || loading || !selectedModelId) return;

    const msgIndex = messages.findIndex((m) => m.id === aiMsg.id);
    const prevUserMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === "user");

    if (!prevUserMsg) return;

    setLoading(true);

    setMessages((prev) => prev.filter((m) => m.id !== aiMsg.id));

    authFetch(`/api/chats/${effectiveChatId}/messages/${aiMsg.id}`, {
      method: "DELETE",
    }).catch(() => {});

    const tempAiMsg: Message = {
      id: Date.now(),
      role: "assistant",
      content: "",
      streamingThinking: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    const selectedTemplate = selectedTemplateId
      ? templates.find((t) => t.id === selectedTemplateId)
      : undefined;

    const systemMsg = buildSystemMessage({
      agentPrompt: selectedTemplate?.agentPrompt,
      templateContent: selectedTemplate?.content,
      projectId: selectedProject,
      projectName,
      openFileTabs,
    });

    const historyMsgs: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...(systemMsg ? [systemMsg] : []),
      ...messages
        .slice(0, msgIndex)
        .filter((m) => m.id !== aiMsg.id && !m.isError)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const result = await streamAiResponse({
      authFetch,
      tempAiMsgId: tempAiMsg.id,
      chatMessages: historyMsgs,
      setMessages,
      abortControllerRef,
      selectedModelId,
      selectedProject,
      onToolCall,
      t,
    });

    // Save AI message to DB
    if (result.aiContent) {
      const finalThinking = result.aiThinking || null;
      const finalSignature = result.aiSignature ?? null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAiMsg.id
            ? {
                ...m,
                content: result.aiContent,
                thinking: finalThinking,
                thinkingSignature: finalSignature,
                streamingThinking: undefined,
              }
            : m
        )
      );

      try {
        const aiRes = await authFetch(`/api/chats/${effectiveChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: result.aiContent,
            thinking: finalThinking,
            thinkingSignature: finalSignature,
            isError: result.hasError,
          }),
        });

        if (aiRes.ok) {
          const savedAi = await aiRes.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiMsg.id
                ? {
                    ...m,
                    id: savedAi.id,
                    content: result.aiContent,
                    thinking: savedAi.thinking ?? finalThinking,
                    thinkingSignature: savedAi.thinkingSignature ?? finalSignature,
                    streamingThinking: undefined,
                  }
                : m
            )
          );
        }
      } catch {
        // DB save failed, content is still visible
      }
    }

    setLoading(false);
  }, [effectiveChatId, loading, selectedModelId, messages, selectedTemplateId, templates, selectedProject, projectName, openFileTabs, onToolCall]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    loading,
    mentionedFiles,
    setMentionedFiles,
    handleSend,
    handleRegenerate,
    handleCancel,
    handleClear,
    abortControllerRef,
  };
}
