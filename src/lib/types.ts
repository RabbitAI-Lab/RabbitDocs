// 流式事件类型
export type StreamDeltaEvent = { type: "text_delta"; text: string };
// Extended Thinking 起始事件（Anthropic content_block_start 中 block.type === "thinking"）
export type StreamThinkingStartEvent = { type: "thinking_start" };
// Extended Thinking 增量事件（Anthropic thinking_delta.delta.thinking）
export type StreamThinkingDeltaEvent = { type: "thinking_delta"; text: string };
// Extended Thinking 签名事件（Anthropic signature_delta.delta.signature）
export type StreamThinkingSignatureEvent = { type: "thinking_signature"; signature: string };
export type StreamDoneEvent = {
  type: "done";
  fullText: string;
  thinking?: string;
  thinkingSignature?: string;
};
export type StreamErrorEvent = {
  type: "error";
  error: string;
  code?: string;
};
export type StreamToolCallEvent = {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
};
export type StreamEvent =
  | StreamDeltaEvent
  | StreamThinkingStartEvent
  | StreamThinkingDeltaEvent
  | StreamThinkingSignatureEvent
  | StreamDoneEvent
  | StreamErrorEvent
  | StreamToolCallEvent;

// API 请求类型
export type ChatCompletionRequest = {
  modelId: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** @deprecated 由前端 system 消息替代 */
  systemPrompt?: string;
  projectId?: string;
  workspaceId?: string;
  chatId?: number;
};

// 文档活动日志
export interface DocumentActivity {
  id: number;
  projectId: string;
  documentPath: string;
  documentTitle: string;
  action: "create" | "update" | "delete" | "rename";
  oldTitle?: string | null;
  createdAt: string;
}

// 自定义错误类
export class ModelError extends Error {
  code:
    | "MODEL_NOT_FOUND"
    | "PROTOCOL_UNSUPPORTED"
    | "INVALID_CONFIG"
    | "SDK_ERROR";

  constructor(
    message: string,
    code:
      | "MODEL_NOT_FOUND"
      | "PROTOCOL_UNSUPPORTED"
      | "INVALID_CONFIG"
      | "SDK_ERROR"
  ) {
    super(message);
    this.name = "ModelError";
    this.code = code;
  }
}

// ========== 项目/工作空间元数据类型（从 fs.ts 迁出） ==========

/**
 * Repository credentials for project integration.
 */
export interface RepositoryCredentials {
  type: "token" | "username_password" | "none";
  token?: string;
  username?: string;
  password?: string;
}

/**
 * Repository metadata for project integration.
 */
export interface Repository {
  id: string;
  name: string;
  url: string;
  type: "github" | "gitlab" | "other";
  credentials: RepositoryCredentials;
  // 同步状态字段
  syncStatus?: "not_cloned" | "synced" | "behind" | "error";
  lastSyncAt?: string;      // 上次同步时间 (ISO)
  lastCheckedAt?: string;   // 上次检查时间 (ISO)
  localCommitHash?: string; // 本地 HEAD commit hash
  remoteCommitHash?: string; // 远程 HEAD commit hash
  errorMessage?: string;    // 错误信息
}

/**
 * Sandbox status for a project.
 */
export interface SandboxStatus {
  enabled: boolean;        // 是否已申请沙盒
  requestedAt?: string;    // 申请时间
  releasedAt?: string;     // 释放时间
}

/**
 * Skill status for a project.
 */
export interface SkillStatus {
  enabled: boolean;
  installedAt?: string;
  uninstalledAt?: string;
  version?: string;
}

/**
 * Project skills configuration.
 */
export interface ProjectSkills {
  ecc?: SkillStatus;
  huashu?: SkillStatus;
}

/**
 * Project member.
 */
export interface ProjectMember {
  id: string;           // UUID
  accountName: string;  // 账号名称
  userId?: string;      // 关联的系统用户 ID（可选，用于权限控制）
  addedAt: string;      // 添加时间 (ISO)
}

/**
 * Project metadata stored as .project.json in each project directory.
 * Also serves as WorkspaceMeta (fields are identical).
 */
export interface ProjectMeta {
  id: string;          // projectId or workspaceId (UUID)
  name: string;        // user-visible name
  description: string;
  createdAt: string;
  accountId: string;   // 所有者的用户 ID（用于目录路径 personal/{accountId}）
  accountType: string;
  ownerId: string;     // 创建者的用户 ID（与 accountId 相同，语义更明确）
  sortOrder: number;   // lower = higher priority (appears first)
  repositories?: Repository[];
  sandbox?: SandboxStatus;  // 沙盒状态
  skills?: ProjectSkills;   // Skills 状态
  members?: ProjectMember[]; // 项目成员
  gitnexusStatus?: GitNexusStatus; // GitNexus 索引状态（项目/工作空间级单例）
}

/** Workspace metadata — identical to ProjectMeta, uses .workspace.json instead. */
export type WorkspaceMeta = ProjectMeta;

// ========== GitNexus 索引状态 ==========

/**
 * Phase of the GitNexus indexing task for a project/workspace root.
 */
export type GitNexusPhase = "idle" | "analyzing" | "cleaning" | "success" | "failed";

/**
 * GitNexus indexing status for a project/workspace root.
 * Persisted under ProjectMeta.gitnexusStatus.
 *
 * Note: 整个 project/workspace 目录视为一个扫描根，共享一个状态。
 *       `--force` 与 `--skip-git` 始终为 true（API 强制），不再由用户配置。
 */
export interface GitNexusStatus {
  phase: GitNexusPhase;
  lastSuccessAt?: string;
  lastError?: string;
  indexExists: boolean; // 物理状态：项目根 .gitnexus/ 是否存在
}
