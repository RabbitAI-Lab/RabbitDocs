"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { Bubble, Sender, Welcome, Prompts, XProvider, Actions } from "@ant-design/x";
import { Button, Space, Avatar, Dropdown, Tooltip, Tag, Typography, Popover, Input, App } from "antd";
import XMarkdown from "@ant-design/x-markdown";
import {
  RobotOutlined,
  UserOutlined,
  SaveOutlined,
  ClearOutlined,
  FileTextOutlined,
  FolderOutlined,
  ProfileOutlined,
  ArrowLeftOutlined,
  RedoOutlined,
  PlusOutlined,
  ShareAltOutlined,
  CopyOutlined,
  ReloadOutlined,
  StopOutlined,
  ThunderboltOutlined,
  DownOutlined,
} from "@ant-design/icons";
import type { BubbleItemType } from "@ant-design/x";
import ChatHistoryPopover from "./ChatHistoryPopover";
import SaveToDocumentModal from "./SaveToDocumentModal";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  // Extended Thinking 思考过程原文（持久化到 chat_messages.thinking）
  thinking?: string | null;
  // Extended Thinking 签名（持久化到 chat_messages.thinking_signature）
  thinkingSignature?: string | null;
  // 流式生成中实时增长的思考过程（生成结束后会清空，最终值写入 thinking）
  streamingThinking?: string;
}

interface ChatWorkspaceProps {
  chatId: number | null;
  chatTitle: string;
  initialMessages: Message[];
  initialModelId?: number;
  initialTemplateId?: number;
  embedded?: boolean;
  projectId?: string;
  projectName?: string;
  openFileTabs?: Array<{ fileName: string; filePath: string }>;
  onBack?: () => void;
  onDocumentSaved?: () => void;
  mentionFile?: string | null;
  onMentionConsumed?: () => void;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  onSwitchToChat?: (chatId: number) => void;
  onChatCreated?: (chatId: number) => void;
  floating?: boolean;
  showProjectSelector?: boolean;
}

export interface ChatWorkspaceRef {
  handleNewChat: () => void;
  handleClear: () => void;
  handleHistorySelect: (chatId: number) => void;
  handleShare: () => void;
  effectiveChatId: number | null;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  shareToken: string | null;
  shareLoading: boolean;
  handleCopyLink: () => void;
  handleRegenerateLink: () => void;
  handleCancelShare: () => void;
}

function buildSystemMessage(options: {
  agentPrompt?: string;
  templateContent?: string;
  projectId?: string;
  projectName?: string;
  openFileTabs?: Array<{ fileName: string; filePath: string }>;
}): { role: "system"; content: string } | null {
  const parts: string[] = [];

  if (options.agentPrompt?.trim()) {
    parts.push(`## Agent 指令\n\n${options.agentPrompt.trim()}`);
  }
  if (options.templateContent?.trim()) {
    parts.push(`## 文档模板\n\n${options.templateContent.trim()}`);
  }

  const contextLines: string[] = [];
  if (options.projectId) {
    contextLines.push(`- 项目ID: ${options.projectId}`);
  }
  if (options.projectName) {
    contextLines.push(`- 项目名称: ${options.projectName}`);
  }
  if (options.openFileTabs && options.openFileTabs.length > 0) {
    contextLines.push(`- 已打开的文件:`);
    for (const f of options.openFileTabs) {
      contextLines.push(`  - ${f.fileName} (${f.filePath})`);
    }
  }
  if (contextLines.length > 0) {
    parts.push(`## 当前上下文\n\n${contextLines.join("\n")}`);
  }

  if (parts.length === 0) return null;
  return { role: "system", content: parts.join("\n\n---\n\n") };
}

const roles = {
  assistant: {
    placement: "start" as const,
    avatar: <Avatar icon={<RobotOutlined />} style={{ backgroundColor: "#1677ff" }} />,
    variant: "borderless" as const,
    typing: { effect: "typing" as const, step: 5, interval: 50 },
  },
  user: {
    placement: "end" as const,
    avatar: <Avatar icon={<UserOutlined />} />,
    variant: "filled" as const,
  },
};

const promptItems = [
  {
    key: "discuss",
    label: "讨论需求",
    description: "描述你的想法，整理为结构化文档",
    icon: <FileTextOutlined />,
  },
  {
    key: "save",
    label: "保存发布",
    description: "一键保存为 Markdown 文档并发布",
    icon: <SaveOutlined />,
  },
];

const switchStyles: Record<string, React.CSSProperties> = {
  root: { fontSize: 12, lineHeight: '20px', padding: '0 4px', gap: 2 },
  icon: { fontSize: 12 },
};

/**
 * Extended Thinking 折叠区。默认展开，可折叠。
 * 在 assistant 气泡顶部展示思考过程原文。
 */
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  if (!text) return null;
  return (
    <div className="mb-2 rounded border border-amber-200 bg-amber-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 w-full text-left hover:bg-amber-50 transition-colors"
      >
        <ThunderboltOutlined />
        <span className="font-medium">思考过程</span>
        <span className="text-amber-500">({text.length} 字)</span>
        <DownOutlined
          className={`ml-auto transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-xs text-gray-700 whitespace-pre-wrap border-t border-amber-200/50">
          {text}
        </div>
      )}
    </div>
  );
}

/**
 * 消费 SSE 流并按 event/data 协议逐个回调。
 * 抽出此 helper 用于消除 handleSend / handleRegenerate 之间的解析逻辑重复。
 */
async function consumeSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (eventType: string, data: { type: string; [k: string]: unknown }) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 \n 切分，保留最后一段作为下一轮 buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("event: ")) {
        const eventType = line.slice(7).trim();
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith("data: ")) {
          i++; // 跳过 data: 行
          try {
            onEvent(eventType, JSON.parse(dataLine.slice(6)));
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
}

const ChatWorkspace = forwardRef<ChatWorkspaceRef, ChatWorkspaceProps>(function ChatWorkspace({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  embedded = false,
  projectId: initialProjectId,
  projectName,
  openFileTabs,
  onBack,
  onDocumentSaved,
  mentionFile,
  onMentionConsumed,
  onToolCall,
  onSwitchToChat,
  onChatCreated,
  floating = false,
  showProjectSelector = false,
}, ref) {
  const router = useRouter();
  const [effectiveChatId, setEffectiveChatId] = useState<number | null>(chatId ?? null);
  const [effectiveChatTitle, setEffectiveChatTitle] = useState<string>(chatTitle);
  const creatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages || []
  );
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<{ id: number; provider: string; modelName: string; isDefault: number }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; agentPrompt?: string; content?: string }[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(initialModelId);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    initialProjectId ?? undefined
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(initialTemplateId);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalContent, setSaveModalContent] = useState("");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const { message } = App.useApp();

  // Persist model/template selection to DB (only when chat exists)
  const updateChatSelection = (field: string, value: number | undefined) => {
    if (!effectiveChatId) return;
    fetch(`/api/chats/${effectiveChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value ?? null }),
    });
  };

  const handleModelChange = (id: number | undefined) => {
    setSelectedModelId(id);
    updateChatSelection("modelId", id);
  };

  const handleProjectChange = (id: string | undefined) => {
    setSelectedProject(id);
    if (!effectiveChatId) return;
    fetch(`/api/chats/${effectiveChatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id ?? null }),
    });
  };

  const handleTemplateChange = (id: number | undefined) => {
    setSelectedTemplateId(id);
    updateChatSelection("templateId", id);
    if (id) {
      localStorage.setItem("last-selected-template-id", String(id));
    } else {
      localStorage.removeItem("last-selected-template-id");
    }
  };

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

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data);
        if (!initialModelId) {
          const defaultModel = data.find((m: { isDefault: number }) => m.isDefault === 1);
          if (defaultModel) {
            setSelectedModelId(defaultModel.id);
          }
        }
      });
    fetch("/api/fs/projects?type=personal&accountId=default")
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []));
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (!initialTemplateId && data.length > 0) {
          const savedTemplateId = localStorage.getItem("last-selected-template-id");
          if (savedTemplateId) {
            const parsed = Number(savedTemplateId);
            const exists = data.some((t: { id: number }) => t.id === parsed);
            if (exists) {
              setSelectedTemplateId(parsed);
            } else {
              localStorage.removeItem("last-selected-template-id");
            }
          }
        }
      });
  }, []);

  // 查询当前会话的分享状态
  useEffect(() => {
    if (!effectiveChatId) {
      setShareToken(null);
      return;
    }
    fetch(`/api/chats/${effectiveChatId}/share`)
      .then((r) => r.json())
      .then((data) => {
        setShareToken(data.token);
      });
  }, [effectiveChatId]);

  const handleShare = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      if (!shareToken) {
        const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setShareToken(data.token);
        }
      }
      setShareOpen(true);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = shareToken ? `${window.location.origin}/share/${shareToken}` : "";
    if (url) {
      navigator.clipboard.writeText(url);
      message.success("分享链接已复制到剪贴板");
    }
  };

  const handleRegenerateLink = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token);
        message.success("已重新生成分享链接");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleCancelShare = async () => {
    if (!effectiveChatId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/chats/${effectiveChatId}/share`, { method: "DELETE" });
      if (res.ok) {
        setShareToken(null);
        setShareOpen(false);
        message.success("已取消分享");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleSend = async (content: string) => {
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
        const chatRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed.slice(0, 50),
            modelId: selectedModelId,
            templateId: selectedTemplateId,
            projectId: selectedProject,
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
      const userRes = await fetch(`/api/chats/${currentChatId}/messages`, {
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
    let aiContent = "";
    // Extended Thinking 思考过程与签名（流式累加）
    let aiThinking = "";
    let aiSignature: string | undefined;
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: fullContent },
      ];

      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages: allMessages,
          projectId: selectedProject,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "请求失败" }));
        aiContent = errData.error || "模型调用失败";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
          )
        );
      } else {
        // Parse SSE stream (走 consumeSseStream helper，新增 3 个 thinking 事件 case)
        const reader = res.body?.getReader();
        if (reader) {
          await consumeSseStream(reader, (eventType, data) => {
            if (eventType === "delta" && data.type === "text_delta" && typeof data.text === "string") {
              aiContent += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                )
              );
            } else if (eventType === "thinking_start" && data.type === "thinking_start") {
              // Extended Thinking 块开始，重置实时 buffer
              aiThinking = "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, streamingThinking: "" } : m
                )
              );
            } else if (eventType === "thinking_delta" && data.type === "thinking_delta" && typeof data.text === "string") {
              aiThinking += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id
                    ? { ...m, streamingThinking: aiThinking }
                    : m
                )
              );
            } else if (eventType === "thinking_signature" && data.type === "thinking_signature" && typeof data.signature === "string") {
              aiSignature = data.signature;
            } else if (eventType === "error") {
              aiContent = (data.error as string) || "模型调用出错";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                )
              );
            } else if (eventType === "done" && data.type === "done") {
              if (!aiContent && typeof data.fullText === "string") {
                aiContent = data.fullText;
              }
              // done 事件中 model-service 会回传全量 thinking + signature
              // 优先用 event 中的值，回落到流式累加结果
              const finalThinking =
                (data.thinking as string | undefined) || (aiThinking || undefined);
              const finalSignature =
                (data.thinkingSignature as string | undefined) || aiSignature;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id
                    ? {
                        ...m,
                        content: aiContent,
                        thinking: finalThinking,
                        thinkingSignature: finalSignature,
                        streamingThinking: undefined,
                      }
                    : m
                )
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
          aiContent = "无法读取响应流";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
            )
          );
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        aiContent = aiContent || "模型调用失败，请重试";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
    }

    // 6. Save AI message to DB（带 Extended Thinking 字段）
    if (aiContent) {
      // 从 messages 中读取最新 thinking/signature（done 时已经更新进去）
      const persisted = messages.find((m) => m.id === tempAiMsg.id);
      const finalThinking = persisted?.thinking ?? (aiThinking || null);
      const finalSignature = persisted?.thinkingSignature ?? aiSignature ?? null;
      const aiRes = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: aiContent,
          thinking: finalThinking,
          thinkingSignature: finalSignature,
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
                  content: aiContent,
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
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    // Remove the last AI message if it has empty content (no streamed content)
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const handleClear = () => {
    setMessages([]);
  };

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {
      if (floating) {
        setEffectiveChatId(null);
        setEffectiveChatTitle("新Chat");
        setMessages([]);
        setInputValue("");
      } else if (selectedProject) {
        router.push(`/chat/new?project=${encodeURIComponent(selectedProject)}`);
      } else {
        router.push("/chat/new");
      }
    },
    handleClear,
    handleHistorySelect: (id: number) => {
      handleHistorySelect(id);
    },
    handleShare,
    get effectiveChatId() { return effectiveChatId; },
    get shareOpen() { return shareOpen; },
    setShareOpen,
    get shareToken() { return shareToken; },
    get shareLoading() { return shareLoading; },
    handleCopyLink,
    handleRegenerateLink,
    handleCancelShare,
  }), [floating, selectedProject, effectiveChatId, shareOpen, shareToken, shareLoading]);

  const loadChat = async (targetChatId: number) => {
    try {
      const [chatRes, msgsRes] = await Promise.all([
        fetch(`/api/chats/${targetChatId}`),
        fetch(`/api/chats/${targetChatId}/messages`),
      ]);
      if (!chatRes.ok || !msgsRes.ok) return;
      const chat = await chatRes.json();
      const msgs = await msgsRes.json();
      setEffectiveChatId(targetChatId);
      setMessages(msgs || []);
      if (chat.title) setEffectiveChatTitle(chat.title);
      if (chat.modelId) setSelectedModelId(chat.modelId);
      if (chat.templateId) setSelectedTemplateId(chat.templateId);
    } catch {
      // silently fail
    }
  };

  const handleHistorySelect = (chatId: number) => {
    if (onSwitchToChat) {
      onSwitchToChat(chatId);
    } else if (floating) {
      loadChat(chatId);
    } else if (embedded) {
      window.location.href = `/chat/${chatId}`;
    } else {
      router.push(`/chat/${chatId}`);
    }
  };

  const handleSaveToDocument = async () => {
    const content = messages
      .map(
        (m) => `### ${m.role === "user" ? "用户" : "助手"}\n\n${m.content}`
      )
      .join("\n\n");
    setSaveModalContent(content);
    setSaveModalOpen(true);
  };

  const handleSaveSingleMessage = async (msg: Message) => {
    const roleLabel = msg.role === "user" ? "用户" : "助手";
    const content = `### ${roleLabel}\n\n${msg.content}`;
    setSaveModalContent(content);
    setSaveModalOpen(true);
  };

  const handleSaved = (docPath: string) => {
    setSaveModalOpen(false);
    onDocumentSaved?.();
  };

  const handleRegenerate = async (aiMsg: Message) => {
    if (!effectiveChatId || loading || !selectedModelId) return;

    const msgIndex = messages.findIndex((m) => m.id === aiMsg.id);
    const prevUserMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === "user");

    if (!prevUserMsg) return;

    setLoading(true);

    setMessages((prev) => prev.filter((m) => m.id !== aiMsg.id));

    fetch(`/api/chats/${effectiveChatId}/messages/${aiMsg.id}`, {
      method: "DELETE",
    }).catch(() => {});

    const tempAiMsg: Message = {
      id: Date.now(),
      role: "assistant",
      content: "",
      streamingThinking: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    // Stream AI response via SSE (same logic as handleSend)
    let aiContent = "";
    // Extended Thinking 思考过程与签名（流式累加）
    let aiThinking = "";
    let aiSignature: string | undefined;
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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

      // Use conversation history up to the previous user message
      const historyMsgs: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        ...(systemMsg ? [systemMsg] : []),
        ...messages
          .slice(0, msgIndex)
          .filter((m) => m.id !== aiMsg.id)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages: historyMsgs,
          projectId: selectedProject,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "请求失败" }));
        aiContent = errData.error || "模型调用失败";
      } else {
        const reader = res.body?.getReader();
        if (reader) {
          await consumeSseStream(reader, (eventType, data) => {
            if (eventType === "delta" && data.type === "text_delta" && typeof data.text === "string") {
              aiContent += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                )
              );
            } else if (eventType === "thinking_start" && data.type === "thinking_start") {
              // Extended Thinking 块开始，重置实时 buffer
              aiThinking = "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, streamingThinking: "" } : m
                )
              );
            } else if (eventType === "thinking_delta" && data.type === "thinking_delta" && typeof data.text === "string") {
              aiThinking += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id
                    ? { ...m, streamingThinking: aiThinking }
                    : m
                )
              );
            } else if (eventType === "thinking_signature" && data.type === "thinking_signature" && typeof data.signature === "string") {
              aiSignature = data.signature;
            } else if (eventType === "error") {
              aiContent = (data.error as string) || "模型调用出错";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                )
              );
            } else if (eventType === "done" && data.type === "done") {
              if (!aiContent && typeof data.fullText === "string") {
                aiContent = data.fullText;
              }
              const finalThinking =
                (data.thinking as string | undefined) || (aiThinking || undefined);
              const finalSignature =
                (data.thinkingSignature as string | undefined) || aiSignature;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiMsg.id
                    ? {
                        ...m,
                        content: aiContent,
                        thinking: finalThinking,
                        thinkingSignature: finalSignature,
                        streamingThinking: undefined,
                      }
                    : m
                )
              );
            } else if (eventType === "tool_call" && data.type === "tool_call") {
              console.log("[ChatWorkspace] tool_call:", data.toolName, data.args);
              onToolCall?.({
                toolName: data.toolName as string,
                args: (data.args as Record<string, unknown>) ?? {},
              });
            }
          });
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        aiContent = aiContent || "模型调用失败，请重试";
      }
    } finally {
      abortControllerRef.current = null;
    }

    // Update the message and save to DB（带 Extended Thinking 字段）
    if (aiContent) {
      // 从 messages 中读取最新 thinking/signature（done 时已经更新进去）
      const persisted = messages.find((m) => m.id === tempAiMsg.id);
      const finalThinking = persisted?.thinking ?? (aiThinking || null);
      const finalSignature = persisted?.thinkingSignature ?? aiSignature ?? null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAiMsg.id
            ? {
                ...m,
                content: aiContent,
                thinking: finalThinking,
                thinkingSignature: finalSignature,
                streamingThinking: undefined,
              }
            : m
        )
      );

      try {
        const aiRes = await fetch(`/api/chats/${effectiveChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: aiContent,
            thinking: finalThinking,
            thinkingSignature: finalSignature,
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
                    content: aiContent,
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
  };

  const renderMarkdown = (content: string) => (
    <Typography>
      <XMarkdown content={content} />
    </Typography>
  );

  // Convert messages to Bubble.List items
  const bubbleItems: BubbleItemType[] = messages.map((msg) => {
    const isAiLoading =
      loading &&
      msg.role === "assistant" &&
      !msg.content &&
      msg === messages[messages.length - 1];

    const hasContent = !!msg.content;
    // Extended Thinking 折叠区显示源：流式生成中用 streamingThinking，否则用持久化的 thinking
    const thinkingText = msg.streamingThinking ?? msg.thinking ?? "";

    // AI 气泡：前置 ThinkingBlock + Markdown 正文（content 改为 ReactNode）
    // 用户气泡：保持原 Markdown contentRender
    const isAssistant = msg.role === "assistant";
    const contentNode = isAssistant ? (
      <div>
        <ThinkingBlock text={thinkingText} />
        {renderMarkdown(msg.content)}
      </div>
    ) : msg.content;

    return {
      key: msg.id.toString(),
      role: msg.role,
      content: contentNode,
      // AI 气泡 content 是 ReactNode，跳过默认 contentRender
      contentRender: isAssistant ? undefined : renderMarkdown,
      loading: isAiLoading || undefined,
      // Only apply typing to new AI messages that have content
      typing:
        isAssistant && msg.content && !isAiLoading
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
                      label: "保存",
                      icon: <SaveOutlined />,
                      onItemClick: () => handleSaveSingleMessage(msg),
                    },
                    {
                      key: "regenerate",
                      label: "重新生成",
                      icon: <RedoOutlined />,
                      onItemClick: () => handleRegenerate(msg),
                    },
                  ]}
                />
                {/* 复制用 msg.content 字符串（而非 contentNode） */}
                <Actions.Copy text={msg.content} />
              </div>
            )
          : () => (
              <Actions.Copy text={msg.content} />
            )
        : undefined,
    };
  });

  return (
    <XProvider>
    <div className="flex flex-col h-full">
      {/* Header - hidden in floating mode, rendered by FloatingChatWindow */}
      {!floating && (
        <div className="flex items-center justify-between px-3 h-[41px] bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          {embedded && onBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={onBack}
            />
          )}
          <h2 className="text-sm font-medium text-gray-800 truncate">
            {effectiveChatTitle}
          </h2>
        </div>
        <Space size="small">
          {/* Save to Document 按钮 - 暂时隐藏，功能待完善
          {messages.length > 0 && (
            selectedProject ? (
              <Button
                type="primary"
                ghost
                icon={<SaveOutlined />}
                size="small"
                onClick={handleSaveToDocument}
              >
                Save to Document
              </Button>
            ) : (
              <Tooltip title="请先在底部选择项目">
                <Button
                  type="primary"
                  ghost
                  icon={<SaveOutlined />}
                  size="small"
                  disabled
                >
                  Save to Document
                </Button>
              </Tooltip>
            )
          )}
          */}
          <Tooltip title="新会话">
            <Button
              type="text"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                if (floating) {
                  setEffectiveChatId(null);
                  setEffectiveChatTitle("新Chat");
                  setMessages([]);
                  setInputValue("");
                } else if (selectedProject) {
                  router.push(`/chat/new?project=${encodeURIComponent(selectedProject)}`);
                } else {
                  router.push("/chat/new");
                }
              }}
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
                      type="primary"
                      icon={<CopyOutlined />}
                      size="small"
                      onClick={handleCopyLink}
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
                      onClick={handleRegenerateLink}
                      block
                    >
                      重新生成
                    </Button>
                    <Button
                      icon={<StopOutlined />}
                      size="small"
                      danger
                      loading={shareLoading}
                      onClick={handleCancelShare}
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
                  onClick={handleShare}
                />
              </Tooltip>
            </Popover>
          )}
          <ChatHistoryPopover
            currentChatId={effectiveChatId}
            onSelect={handleHistorySelect}
          />
          <Tooltip title="Clear">
            <Button
              type="text"
              icon={<ClearOutlined />}
              size="small"
              onClick={handleClear}
            />
          </Tooltip>
        </Space>
      </div>
      )}

      {/* Main content */}
      {messages.length === 0 && !floating ? (
        <div className="flex-1 flex items-center justify-center">
          <div style={{ width: 600 }}>
            <Welcome
              icon={
                <RobotOutlined style={{ fontSize: 40, color: "#1677ff" }} />
              }
              title="Start New Chat"
              description="Enter a message below to start chatting. You can save the conversation as a Markdown document."
            />
            <Prompts
              title="你可以尝试"
              items={promptItems}
              onItemClick={(info) => {
                if (info.data.key === "discuss") {
                  setInputValue("我想讨论一个新需求...");
                } else if (info.data.key === "save") {
                  setInputValue("请帮我整理一份文档...");
                }
              }}
              styles={{ item: { width: "calc(50% - 8px)" } }}
              wrap
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Bubble.List
            style={{ height: "100%", maxWidth: '48rem', margin: '0 auto' }}
            items={bubbleItems}
            role={roles}
            autoScroll
          />
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <Sender
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSend}
            loading={loading}
            onCancel={handleCancel}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            suffix={false}
            header={
              mentionedFiles.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 12px" }}>
                  {mentionedFiles.map((filePath) => {
                    const fileName = filePath.split("/").pop() || filePath;
                    return (
                      <Tag
                        key={filePath}
                        closable
                        onClose={() =>
                          setMentionedFiles((prev) =>
                            prev.filter((f) => f !== filePath)
                          )
                        }
                        style={{ margin: 0 }}
                      >
                        @{fileName}
                      </Tag>
                    );
                  })}
                </div>
              ) : false
            }
            styles={{ root: { backgroundColor: '#fff' } }}
            footer={(oriNode) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <div style={{ display: 'flex' }}>
                  <Dropdown
                    getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                    menu={{
                      items: [
                        ...(selectedModelId ? [{ key: '__clear_model__', label: '✕ 清除选择' }] : []),
                        ...models.map((m) => ({ key: String(m.id), label: `${m.provider} / ${m.modelName}` })),
                      ],
                      onClick: ({ key }) => {
                        if (key === '__clear_model__') {
                          handleModelChange(undefined);
                        } else {
                          handleModelChange(Number(key));
                        }
                      },
                      selectedKeys: selectedModelId ? [String(selectedModelId)] : [],
                    }}
                  >
                    <Sender.Switch
                      value={!!selectedModelId}
                      icon={<RobotOutlined />}
                      checkedChildren={models.find((m) => m.id === selectedModelId)?.modelName}
                      unCheckedChildren="模型"
                      styles={switchStyles}
                    />
                  </Dropdown>
                  {((!embedded) || showProjectSelector) && projects.length > 0 && (
                    <Dropdown
                      getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                      menu={{
                        items: [
                          ...(selectedProject ? [{ key: '__clear_project__', label: '✕ 清除选择' }] : []),
                          ...projects.map((p) => ({ key: p.id, label: p.name })),
                        ],
                        onClick: ({ key }) => {
                          if (key === '__clear_project__') {
                            handleProjectChange(undefined);
                          } else {
                            handleProjectChange(key);
                          }
                        },
                        selectedKeys: selectedProject ? [selectedProject] : [],
                      }}
                    >
                      <Sender.Switch
                        value={!!selectedProject}
                        icon={<FolderOutlined />}
                        checkedChildren={projects.find((p) => p.id === selectedProject)?.name}
                        unCheckedChildren="项目"
                        styles={switchStyles}
                      />
                    </Dropdown>
                  )}
                  {templates.length > 0 && (
                    <Dropdown
                      getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
                      menu={{
                        items: [
                          ...(selectedTemplateId ? [{ key: '__clear_template__', label: '✕ 清除选择' }] : []),
                          ...templates.map((t) => ({ key: String(t.id), label: t.name })),
                        ],
                        onClick: ({ key }) => {
                          if (key === '__clear_template__') {
                            handleTemplateChange(undefined);
                          } else {
                            handleTemplateChange(Number(key));
                          }
                        },
                        selectedKeys: selectedTemplateId ? [String(selectedTemplateId)] : [],
                      }}
                    >
                      <Sender.Switch
                        value={!!selectedTemplateId}
                        icon={<ProfileOutlined />}
                        checkedChildren={templates.find((t) => t.id === selectedTemplateId)?.name}
                        unCheckedChildren="模板"
                        styles={switchStyles}
                      />
                    </Dropdown>
                  )}
                </div>
                {oriNode}
              </div>
            )}
          />
        </div>
      </div>
    </div>
    <SaveToDocumentModal
      open={saveModalOpen}
      projectId={selectedProject}
      content={saveModalContent}
      onClose={() => setSaveModalOpen(false)}
      onSaved={handleSaved}
    />
    </XProvider>
  );
});

export default ChatWorkspace;
