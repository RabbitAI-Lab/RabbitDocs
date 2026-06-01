"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bubble, Sender, Welcome, Prompts, XProvider, Actions } from "@ant-design/x";
import { Button, Space, Avatar, Dropdown, Tooltip, Tag, Typography } from "antd";
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
} from "@ant-design/icons";
import type { BubbleItemType } from "@ant-design/x";
import ChatHistoryPopover from "./ChatHistoryPopover";
import SaveToDocumentModal from "./SaveToDocumentModal";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface ChatWorkspaceProps {
  chatId: number | null;
  chatTitle: string;
  initialMessages: Message[];
  initialModelId?: number;
  initialTemplateId?: number;
  embedded?: boolean;
  projectId?: string;
  onBack?: () => void;
  onDocumentSaved?: () => void;
  mentionFile?: string | null;
  onMentionConsumed?: () => void;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  onSwitchToChat?: (chatId: number) => void;
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

export default function ChatWorkspace({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  embedded = false,
  projectId: initialProjectId,
  onBack,
  onDocumentSaved,
  mentionFile,
  onMentionConsumed,
  onToolCall,
  onSwitchToChat,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [effectiveChatId, setEffectiveChatId] = useState<number | null>(chatId ?? null);
  const creatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages || []
  );
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<{ id: number; provider: string; modelName: string; isDefault: number }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; agentPrompt?: string }[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(initialModelId);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    initialProjectId ?? undefined
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(initialTemplateId);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalContent, setSaveModalContent] = useState("");

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
        if (!embedded) {
          window.history.replaceState(null, "", `/chat/${chat.id}`);
          router.refresh();
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
    }

    // 4. Add AI placeholder message (loading bubble)
    const tempAiMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    // 5. Stream AI response via SSE
    let aiContent = "";
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const systemPrompt = selectedTemplateId
        ? templates.find((t) => t.id === selectedTemplateId)?.agentPrompt
        : undefined;

      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: fullContent },
          ],
          systemPrompt,
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
        // Parse SSE stream
        const reader = res.body?.getReader();
        if (!reader) {
          aiContent = "无法读取响应流";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
            )
          );
        } else {
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith("event: ")) {
                const eventType = line.slice(7).trim();
                // Next line should be data:
                const dataLine = lines[i + 1];
                if (dataLine?.startsWith("data: ")) {
                  i++; // Skip data line
                  const dataStr = dataLine.slice(6);
                  try {
                    const data = JSON.parse(dataStr);
                    if (eventType === "delta" && data.type === "text_delta") {
                      aiContent += data.text;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === tempAiMsg.id
                            ? { ...m, content: aiContent }
                            : m
                        )
                      );
                    } else if (eventType === "error") {
                      aiContent = data.error || "模型调用出错";
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === tempAiMsg.id
                            ? { ...m, content: aiContent }
                            : m
                        )
                      );
                    } else if (eventType === "done" && data.type === "done") {
                      if (!aiContent && data.fullText) {
                        aiContent = data.fullText;
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === tempAiMsg.id
                              ? { ...m, content: aiContent }
                              : m
                          )
                        );
                      }
                    } else if (eventType === "tool_call" && data.type === "tool_call") {
                      console.log("[ChatWorkspace] tool_call:", data.toolName, data.args);
                      onToolCall?.({ toolName: data.toolName, args: data.args });
                    }
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
          }
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

    // 6. Save AI message to DB
    if (aiContent) {
      const aiRes = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: aiContent }),
      });

      if (aiRes.ok) {
        const savedAi = await aiRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiMsg.id
              ? { ...m, id: savedAi.id, content: aiContent }
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

  const handleHistorySelect = (chatId: number) => {
    if (onSwitchToChat) {
      onSwitchToChat(chatId);
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
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    // Stream AI response via SSE (same logic as handleSend)
    let aiContent = "";
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const systemPrompt = selectedTemplateId
        ? templates.find((t) => t.id === selectedTemplateId)?.agentPrompt
        : undefined;

      // Use conversation history up to the previous user message
      const historyMsgs = messages
        .slice(0, msgIndex)
        .filter((m) => m.id !== aiMsg.id)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages: historyMsgs,
          systemPrompt,
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
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith("event: ")) {
                const eventType = line.slice(7).trim();
                const dataLine = lines[i + 1];
                if (dataLine?.startsWith("data: ")) {
                  i++;
                  try {
                    const data = JSON.parse(dataLine.slice(6));
                    if (eventType === "delta" && data.type === "text_delta") {
                      aiContent += data.text;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === tempAiMsg.id
                            ? { ...m, content: aiContent }
                            : m
                        )
                      );
                    } else if (eventType === "error") {
                      aiContent = data.error || "模型调用出错";
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === tempAiMsg.id
                            ? { ...m, content: aiContent }
                            : m
                        )
                      );
                    } else if (eventType === "done" && data.type === "done") {
                      if (!aiContent && data.fullText) {
                        aiContent = data.fullText;
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === tempAiMsg.id
                              ? { ...m, content: aiContent }
                              : m
                          )
                        );
                      }
                    } else if (eventType === "tool_call" && data.type === "tool_call") {
                      console.log("[ChatWorkspace] tool_call:", data.toolName, data.args);
                      onToolCall?.({ toolName: data.toolName, args: data.args });
                    }
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        aiContent = aiContent || "模型调用失败，请重试";
      }
    } finally {
      abortControllerRef.current = null;
    }

    // Update the message and save to DB
    if (aiContent) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
        )
      );

      try {
        const aiRes = await fetch(`/api/chats/${effectiveChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: aiContent }),
        });

        if (aiRes.ok) {
          const savedAi = await aiRes.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiMsg.id
                ? { ...m, id: savedAi.id, content: aiContent }
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

    return {
      key: msg.id.toString(),
      role: msg.role,
      content: msg.content,
      contentRender: renderMarkdown,
      loading: isAiLoading || undefined,
      // Only apply typing to new AI messages that have content
      typing:
        msg.role === "assistant" && msg.content && !isAiLoading
          ? { effect: "typing" as const, step: 5, interval: 50 }
          : undefined,
      footer: hasContent
        ? msg.role === "assistant"
          ? (content: string) => (
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
                <Actions.Copy text={String(content)} />
              </div>
            )
          : (content: string) => (
              <Actions.Copy text={String(content)} />
            )
        : undefined,
    };
  });

  return (
    <XProvider>
    <div className="flex flex-col h-full">
      {/* Header */}
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
            {chatTitle}
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
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                if (selectedProject) {
                  router.push(`/chat/new?project=${encodeURIComponent(selectedProject)}`);
                } else {
                  router.push("/chat/new");
                }
              }}
            />
          </Tooltip>
          <ChatHistoryPopover
            currentChatId={effectiveChatId}
            onSelect={handleHistorySelect}
          />
          <Tooltip title="Clear">
            <Button
              icon={<ClearOutlined />}
              size="small"
              onClick={handleClear}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Main content */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div style={{ width: 600 }}>
            <Welcome
              icon={
                <RobotOutlined style={{ fontSize: 40, color: "#1677ff" }} />
              }
              title="开始新对话"
              description="在下方输入消息开始聊天。你可以将对话内容保存为 Markdown 文档。"
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
                  {!embedded && projects.length > 0 && (
                    <Dropdown
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
}
