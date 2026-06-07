import type { TreeNode } from "@/lib/tree";
import type { Repository, SandboxStatus, ProjectMember, GitNexusStatus } from "@/lib/fs";

import type { DocumentActivity, RecentChat } from "@/lib/types";

/** 固定标签 ID：项目信息页 */
export const PROJECT_INFO_TAB = "__project_info__" as const;

/** 固定标签 ID：聊天页 */
export const CHAT_TAB = "__chat__" as const;

/** 文件标签页 */
export interface FileTab {
  filePath: string;
  content: string;
  loaded: boolean;
  type: "markdown" | "html";
}

/** 项目元数据（完整版） */
export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  ownerId: string;     // 创建者的用户 ID（Owner 权限标识）
  sortOrder: number;
  repositories?: Repository[];
  sandbox?: SandboxStatus;
  members?: ProjectMember[];
  gitnexusStatus?: GitNexusStatus;
}

/** 账户信息 */
export interface AccountInfo {
  accountName: string;
  orgName?: string;
  enterpriseName?: string;
}

/** 最近聊天记录摘要（已移至 @/lib/types） */
export type { RecentChat };

/** 主组件 Props — 对外接口保持不变 */
export interface ProjectWorkspaceProps {
  projectName: string;
  projectPath: string; // e.g. "personal/default/projects/{projectId}"
  docsPath: string; // e.g. "personal/default/projects/{projectId}/docs"
  tree: TreeNode[];
  rootTree: TreeNode[];
  rootPath: string; // e.g. "personal/default/projects/{projectId}"
  selectedFile: string | null; // relative path within project, from ?file= URL param
  initialContent: string; // file content preloaded by server
  projectMeta: ProjectMeta | null;
  /** @deprecated 未使用，保留以向后兼容 */
  accountInfo: AccountInfo;
  recentChats: RecentChat[];
  recentDocuments?: DocumentActivity[];
  /** Owner 用户信息（服务端查询，用于成员页显示名称） */
  ownerUser?: { name: string | null; email: string } | null;
  /** URL 参数传入的 chatId，用于自动加载指定 chat 并切换到 chat tab */
  initialChatId?: number;
  /** URL 参数传入的子Tab，用于恢复上次的子Tab选择 */
  initialSubTab?: string;
  /** URL 参数 ?openChat=true 控制是否自动打开 Chat tab */
  autoOpenChat?: boolean;
}
