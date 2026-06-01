"use client";

import { useState, useEffect } from "react";
import type { Repository, SandboxStatus, ProjectMember } from "@/lib/fs";
import ActivityPanel from "./ActivityPanel";
import IntegrationPanel from "./IntegrationPanel";
import McpPanel from "./McpPanel";
import SkillsPanel from "./SkillsPanel";
import MemberManager from "./MemberManager";
import Badge from "@/components/ui/Badge";

interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  accountId: string;
  accountType: string;
  sortOrder: number;
  repositories?: Repository[];
  sandbox?: SandboxStatus;
  members?: ProjectMember[];
}

interface RecentChat {
  id: number;
  title: string;
  updatedAt: string;
}

type SubTab = "activity" | "integration" | "skills" | "mcp" | "members";

interface ProjectInfoTabProps {
  projectId: string;
  projectName: string;
  projectMeta: ProjectMeta | null;
  projectPath: string;
  recentChats: RecentChat[];
  onSwitchToChat: (chatId: number) => void;
  onNewChat: () => void;
}

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "integration", label: "Integration" },
  { key: "skills", label: "Skills" },
  { key: "mcp", label: "MCP" },
  { key: "members", label: "成员" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ProjectInfoTab({
  projectName,
  projectMeta,
  projectPath,
  recentChats,
  onSwitchToChat,
  onNewChat,
}: ProjectInfoTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("activity");
  const [repositories, setRepositories] = useState<Repository[]>(
    projectMeta?.repositories || []
  );
  const [sandbox, setSandbox] = useState<SandboxStatus>(
    projectMeta?.sandbox || { enabled: false }
  );
  const [hasUnsynced, setHasUnsynced] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>(
    projectMeta?.members || []
  );

  const dirSegments = projectPath.split(",");

  // 检查同步状态
  useEffect(() => {
    if (repositories.length === 0) {
      setHasUnsynced(false);
      return;
    }

    // 调用批量状态检查 API
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/fs/project-repositories/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dirSegments }),
        });

        if (res.ok) {
          const data = await res.json();
          // 更新仓库状态
          const updatedRepos = repositories.map((repo) => {
            const result = data.results.find((r: { repoId: string }) => r.repoId === repo.id);
            if (result) {
              return {
                ...repo,
                syncStatus: result.status,
                localCommitHash: result.localHash,
                remoteCommitHash: result.remoteHash,
                errorMessage: result.error,
              };
            }
            return repo;
          });
          setRepositories(updatedRepos);

          // 检查是否有未同步的仓库
          const unsynced = updatedRepos.some(
            (r) => r.syncStatus === "not_cloned" || r.syncStatus === "behind" || r.syncStatus === "error"
          );
          setHasUnsynced(unsynced);
        }
      } catch {
        // 检查失败时，如果仓库没有 syncStatus，则默认显示小红点
        const needsSync = repositories.some((r) => !r.syncStatus || r.syncStatus === "not_cloned");
        setHasUnsynced(needsSync);
      }
    };

    checkStatus();
  }, [repositories.length]); // 只在仓库数量变化时检查

  // 切换到 Integration tab 时隐藏小红点
  const handleTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    if (tab === "integration") {
      setHasUnsynced(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Project header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-800">{projectName}</h2>
            <p className="text-xs text-gray-400">
              {projectMeta?.description || "暂无描述"}
            </p>
          </div>
          <button
            onClick={onNewChat}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            开始对话
          </button>
        </div>
        {projectMeta?.createdAt && (
          <div className="text-xs text-gray-400 ml-12">
            创建于 {formatDate(projectMeta.createdAt)}
          </div>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="flex items-center px-6 border-b border-gray-200 shrink-0">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSubTab === tab.key
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.key === "integration" && hasUnsynced && (
              <Badge variant="dot" className="ml-1.5" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeSubTab === "activity" && (
          <ActivityPanel
            recentChats={recentChats}
            onSwitchToChat={onSwitchToChat}
            onNewChat={onNewChat}
          />
        )}
        {activeSubTab === "integration" && (
          <IntegrationPanel
            projectPath={projectPath}
            repositories={repositories}
            sandbox={sandbox}
            onRepositoriesChange={setRepositories}
            onSandboxChange={setSandbox}
          />
        )}
        {activeSubTab === "skills" && (
          <SkillsPanel projectPath={projectPath} />
        )}
        {activeSubTab === "mcp" && (
          <McpPanel projectPath={projectPath} />
        )}
        {activeSubTab === "members" && (
          <MemberManager
            projectPath={projectPath}
            members={members}
            onMembersChange={setMembers}
          />
        )}
      </div>
    </div>
  );
}
