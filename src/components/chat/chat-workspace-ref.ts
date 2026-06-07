export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  // Extended Thinking 思考过程原文（持久化到 chat_messages.thinking）
  thinking?: string | null;
  // Extended Thinking 签名（持久化到 chat_messages.thinking_signature）
  thinkingSignature?: string | null;
  // 流式生成中实时增长的思考过程（生成结束后会清空，最终值写入 thinking）
  streamingThinking?: string;
  // 标记该消息是否为错误消息（如 529 模型过载等），错误消息不参与后续模型调用
  isError?: boolean;
}

export interface ChatWorkspaceProps {
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
  workspaceId?: string;
  onRefStateChange?: (state: { effectiveChatId: number | null; shareOpen: boolean; shareToken: string | null; shareLoading: boolean }) => void;
}

export interface ChatWorkspaceRef {
  handleNewChat: () => void;
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
